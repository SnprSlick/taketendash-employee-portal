import puppeteer from "puppeteer";
import type { OutlineSection, OutlineTag } from "./generateOutline";
import type { Role, WorkflowNote } from "@/lib/workflow/flow/types";
import { parseLabel } from "@/lib/workflow/flow/mentions";

// Letter at 96dpi minus the 20px page margins used in pdf() below.
const PAGE_WIDTH_PX = 816 - 40;
const PAGE_HEIGHT_PX = 1056 - 40;

// Runs in the page. 1) Pushes any section that would straddle a page break to
// the next page (so measured positions stay true to the printed ones), then
// 2) draws a faint line from each non-sequential "go to" number to the step it points at.
function layoutAndDrawJumpLines(pageHeight: number) {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".section"));
  const isBlock = (el: Element | null): el is HTMLElement => !!el && el.classList.contains("section");
  // Place `el` so its top edge sits exactly at `y`. Sibling margins collapse, so
  // the previous section's bottom margin is cleared and the full gap set here.
  const moveTo = (el: HTMLElement, y: number) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const prev = el.previousElementSibling as HTMLElement | null;
    if (isBlock(prev)) {
      const prevBottom = prev.getBoundingClientRect().bottom + window.scrollY;
      prev.style.marginBottom = "0px";
      el.style.marginTop = `${Math.max(0, y - prevBottom)}px`;
    } else {
      el.style.marginTop = `${(parseFloat(getComputedStyle(el).marginTop) || 0) + (y - top)}px`;
    }
  };
  for (const el of sections) {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const pageStart = Math.floor(top / pageHeight) * pageHeight;
    // The browser drops a margin that straddles a page break, pulling the next
    // section up to the page top; do the same here so positions stay true.
    const prevEl = el.previousElementSibling as HTMLElement | null;
    const prevBottom = isBlock(prevEl) ? prevEl.getBoundingClientRect().bottom + window.scrollY : null;
    if (prevBottom !== null && prevBottom <= pageStart + 0.5 && top - pageStart > 0.5 && top > pageHeight) {
      moveTo(el, pageStart);
      continue;
    }
    if (r.height > pageHeight) continue;
    const pageEnd = pageStart + pageHeight;
    if (top + r.height > pageEnd + 0.5) moveTo(el, pageEnd);
  }

  const NS = "http://www.w3.org/2000/svg";
  const height = document.documentElement.scrollHeight;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(document.body.clientWidth));
  svg.setAttribute("height", String(height));
  svg.setAttribute("style", "position:absolute;left:0;top:0;pointer-events:none;overflow:visible");
  svg.innerHTML =
    `<defs><marker id="jump-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">` +
    `<path d="M0,0 L6,3 L0,6 z" fill="#64748b" fill-opacity="0.45"/></marker></defs>`;

  const scopeOf = (el: Element) => el.closest(".sub-sections");
  let lane = 0;
  document.querySelectorAll<HTMLElement>("[data-go]").forEach((numEl) => {
    const scope = scopeOf(numEl);
    const target = Array.from(document.querySelectorAll<HTMLElement>(`[data-sec="${numEl.dataset.go}"]`)).find(
      (t) => scopeOf(t) === scope,
    );
    const row = numEl.closest<HTMLElement>(".link");
    if (!target || !row) return;
    // Sequential routes (into the very next section) get no line.
    const from = row.closest<HTMLElement>(".section");
    const next = from ? sections[sections.indexOf(from) + 1] : undefined;
    if (next && next.contains(target) && !numEl.dataset.force) return;
    const rr = row.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const sx = rr.left - 2;
    const sy = rr.top + window.scrollY + rr.height / 2;
    const tx = tr.left - 2;
    const ty = tr.top + window.scrollY + 12;
    const laneX = 30 - (lane++ % 4) * 6;
    const dir = ty > sy ? 1 : -1;
    const r = 4;
    const d =
      `M${sx},${sy} H${laneX + r} Q${laneX},${sy} ${laneX},${sy + dir * r} ` +
      `V${ty - dir * r} Q${laneX},${ty} ${laneX + r},${ty} H${tx}`;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#64748b");
    path.setAttribute("stroke-opacity", "0.3");
    path.setAttribute("stroke-width", "1");
    path.setAttribute("marker-end", "url(#jump-arrow)");
    svg.appendChild(path);
  });
  document.body.appendChild(svg);
}

export async function renderWorkflowPdf({
  workflowName,
  outline,
  notes,
  roles = [],
  subtitle = "Step-by-step document control outline",
}: {
  workflowName: string;
  subtitle?: string;
  outline: OutlineSection[];
  notes?: WorkflowNote[];
  roles?: Role[];
}): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    // Container (Railway) has no user namespaces; enabled via the Dockerfile.
    args: process.env.PUPPETEER_NO_SANDBOX === "1" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
  });
  try {
    const outlineHtml = renderSections(outline, roles);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { position: relative; font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            .subtitle { color: #64748b; font-size: 13px; margin-bottom: 24px; }

            .outline { font-size: 13px; position: relative; }
            .node-chain { display: flex; flex-direction: column; }
            .node-box { position: relative; display: inline-flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; margin-bottom: 0; max-width: 480px; }
            .node-box.decision { border-color: #fbbf24; background: #fffbeb; }
            .node-box.start { border-color: #10b981; background: #ecfdf5; }
            .node-box.end { border-color: #1e293b; background: #f1f5f9; }
            .node-box.has-bin { border-width: 3px; }
            .node-box.subworkflow-missing { border-color: #ef4444; background: #fef2f2; color: #b91c1c; }

            .subworkflow-block { border: 1px dashed #a78bfa; border-radius: 8px; padding: 10px 14px; background: #f5f3ff; }
            .subworkflow-marker { font-size: 10px; font-weight: 700; letter-spacing: 0.03em; color: #7c3aed; text-transform: uppercase; }
            .subworkflow-body { margin: 6px 0; padding-left: 4px; }
            .node-kind { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
            .node-label { font-size: 13px; color: #0f172a; }
            .mention { font-weight: 600; padding: 0 3px; border-radius: 3px; }
            .node-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
            .tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; }
            .node-box.decision .section-num, .node-box.decision .node-label { color: #fff; }
            .node-box.decision .node-kind .tag.role { background: rgba(255,255,255,0.25) !important; color: #fff !important; }
            .node-box.decision .mention { background: rgba(255,255,255,0.25) !important; color: #fff !important; }
            .node-box.decision .tag.bin { box-shadow: 0 0 0 1px rgba(255,255,255,0.7); }
            .node-kind .kind-label { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #b45309; }
            .node-box.decision .kind-label { color: rgba(255,255,255,0.9); }
            .node-kind .tag { text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 10px; margin-left: 4px; }
            .tag.bin { background: #0e7490; color: #fff; font-weight: 700; }

            .section { margin: 0 0 12px 0; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
            .section.start { margin-top: 18px; }
            .section.start:first-child { margin-top: 0; }
            .section-num { font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
            .links { margin: 6px 0 0 2px; display: flex; flex-direction: column; gap: 3px; }
            .link { font-size: calc(12px + 2pt); font-weight: 700; color: #334155; }
            .link.release { color: #6d28d9; }
            .link .num { font-weight: 800; color: #0f172a; }
            .link .answer { font-weight: 700; color: #b45309; }
            .link .outside { font-size: 10px; color: #94a3b8; font-style: italic; margin-left: 4px; }
            .link .link-tag { font-size: 10px; color: #0e7490; margin-left: 6px; }
            .link-note { font-size: 11px; color: #64748b; font-style: italic; }
            .end-note { margin-top: 6px; font-size: 12px; color: #64748b; font-style: italic; }
            .sub-sections { margin: 8px 0 2px 0; padding-left: 10px; border-left: 2px solid #c4b5fd; }

            .notes-section { margin-top: 24px; }
            .notes-section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 0 0 10px 0; }
            .note-card { padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-bottom: 8px; }
            .note-card p { font-size: 13px; white-space: pre-wrap; margin: 0; }
          </style>
        </head>
        <body>
          <div>
            <h1${subtitle ? "" : ' style="margin-bottom:20px"'}>${escapeHtml(workflowName)}</h1>
            ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
            <div class="outline">${outlineHtml || "<p>No steps defined yet.</p>"}</div>
            ${renderNotesHtml(notes)}
          </div>
        </body>
      </html>
    `;

    const pdfPage = await browser.newPage();
    // Match the printable width/height so measured positions equal printed ones.
    await pdfPage.setViewport({ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX });
    await pdfPage.emulateMediaType("print");
    await pdfPage.setContent(html, { waitUntil: "load" });
    await pdfPage.evaluate(layoutAndDrawJumpLines, PAGE_HEIGHT_PX);
    if (process.env.DEBUG_OUTLINE_HTML) {
      const debugHtml = await pdfPage.content();
      const fs = await import("fs/promises");
      await fs.writeFile(process.env.DEBUG_OUTLINE_HTML, debugHtml);
    }
    const pdfBuffer = await pdfPage.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

const DECISION_FALLBACK_COLOR = "#d97706";

function renderTagsHtml(tag: OutlineTag): string {
  if (!tag.binLabel) return "";
  const bg = readableOnWhite(tag.binColor ?? "#0e7490");
  return `<div class="node-tags"><span class="tag bin" style="background:${bg}">Bin: ${escapeHtml(tag.binLabel)}</span></div>`;
}

// Bin pills are bold with white text; a colour too light for white text
// (e.g. yellow) is darkened until it reads clearly.
function readableOnWhite(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0e7490";
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const lum = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const contrast = () => 1.05 / (0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b) + 0.05);
  for (let i = 0; i < 20 && contrast() < 3.5; i++) [r, g, b] = [r, g, b].map((c) => Math.round(c * 0.9));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Role shown beside the step number at the top of the box.
function renderRoleHtml(tag: OutlineTag): string {
  if (!tag.roleTitle) return "";
  const color = tag.roleColor ?? "#4338ca";
  return ` <span class="tag role" style="background:${color}26;color:${color}">${escapeHtml(tag.roleTitle)}</span>`;
}

// Box takes the role's colour as a tinted background; a bin colours the border.
function boxStyle(tag: OutlineTag, kind?: OutlineSection["kind"]): string {
  const parts: string[] = [];
  if (kind === "decision") {
    // Decisions are solid, like the editor's node view, with white text.
    const solid = tag.roleColor ?? DECISION_FALLBACK_COLOR;
    parts.push(`background:${solid}`, `border-color:${tag.binColor ?? solid}`);
  } else {
    if (tag.roleColor) parts.push(`background:${tag.roleColor}1f`);
    if (tag.binColor) parts.push(`border-color:${tag.binColor}`);
  }
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function renderLabelHtml(label: string, roles: Role[]): string {
  return parseLabel(label)
    .map((seg) => {
      if (seg.type === "text") return escapeHtml(seg.value);
      const role = roles.find((r) => r.id === seg.roleId);
      const color = role?.color ?? "#64748b";
      return `<span class="mention" style="background:${color}26;color:${color}">@${escapeHtml(role?.title ?? seg.title)}</span>`;
    })
    .join("");
}


function renderSections(sections: OutlineSection[], roles: Role[]): string {
  return sections.map((section, i) => renderSection(section, roles, sections[i + 1]?.number)).join("");
}

function renderReleases(section: OutlineSection): string {
  return (section.releases ?? [])
    .map(
      (r) =>
        `<div class="link release">Releases wait <span class="num">${escapeHtml(r.waitNumber)}</span> &rarr; continue at ${r.continueAt
          .map((n) => `<span class="num" data-go="${escapeHtml(n)}" data-force="1">${escapeHtml(n)}</span>`)
          .join(" and ")}</div>`,
    )
    .join("");
}

function renderLinks(section: OutlineSection, nextNumber?: string): string {
  const withReleases = (html: string) => {
    const releases = renderReleases(section);
    if (!releases) return html;
    return html.startsWith('<div class="links">')
      ? html.replace(/<\/div>$/, `${releases}</div>`)
      : `${html}<div class="links">${releases}</div>`;
  };
  return withReleases(renderLinkRows(section, nextNumber));
}

function renderLinkRows(section: OutlineSection, nextNumber?: string): string {
  if (section.kind === "end") return `<div class="end-note">End of workflow.</div>`;
  if (section.kind === "wait") {
    // A wait is a break, so its way on is always spelled out (never "next").
    const rows = section.links
      .filter((l) => !l.outside)
      .map(
        (l) =>
          `<div class="link">Once released &rarr; continue at <span class="num" data-go="${escapeHtml(l.number)}" data-force="1">${escapeHtml(l.number)}</span></div>`,
      );
    return rows.length ? `<div class="links">${rows.join("")}</div>` : "";
  }
  // Links that leave a partial export are dropped entirely.
  const kept = section.links.filter((l) => !l.outside);
  if (kept.length === 0) return "";
  // A single route into the very next section needs no "go to": a plain step
  // shows nothing, a decision just shows the answer that was chosen.
  if (!section.parallel && kept.length === 1 && kept[0].number === nextNumber) {
    return section.kind === "decision" && kept[0].answer
      ? `<div class="links"><div class="link"><span class="answer">${escapeHtml(kept[0].answer)}</span></div></div>`
      : "";
  }
  // Links sharing an answer (one choice fanning out) read as a single line.
  const grouped = new Map<string, OutlineSection["links"]>();
  kept.forEach((l) => {
    const key = l.answer ?? "";
    grouped.set(key, [...(grouped.get(key) ?? []), l]);
  });
  const rows = [...grouped.entries()].map(([answer, links]) => {
    const targets = links
      .map(
        (l) =>
          l.number === nextNumber
            ? `<span class="num">next</span>`
            : `<span class="num" data-go="${escapeHtml(l.number)}">${escapeHtml(l.number)}</span>`,
      )
      .join(" and ");
    const lead =
      section.kind === "decision" ? `<span class="answer">${escapeHtml(answer)}</span>` : section.parallel ? "At the same time" : "Next";
    const together = section.kind === "decision" && links.length > 1 ? " (at the same time)" : "";
    return `<div class="link">${lead} &rarr; go to ${targets}${together}</div>`;
  });
  const note = section.parallel ? `<div class="link-note">Continue all of these; they run in parallel.</div>` : "";
  return `<div class="links">${rows.join("")}${note}</div>`;
}

function renderSection(section: OutlineSection, roles: Role[], nextNumber?: string): string {
  const binClass = section.tag.binColor ? " has-bin" : "";
  const kindClass = section.kind === "subworkflow" || section.kind === "wait" ? "" : section.kind;
  const sub = section.subworkflow;

  if (sub?.missing) {
    return `
      <div class="section">
        <div class="node-box subworkflow-missing" data-sec="${escapeHtml(section.number)}">
          <div class="node-kind"><span class="section-num">${escapeHtml(section.number)}</span></div>
          <div class="node-label">&#9888; Missing sub-workflow reference</div>
        </div>
        ${renderLinks(section, nextNumber)}
      </div>
    `;
  }

  const subHtml = sub
    ? `<div class="subworkflow-marker">&#9656; Begin sub-workflow: ${escapeHtml(sub.name)}</div>
       <div class="sub-sections">${renderSections(sub.sections, roles)}</div>
       <div class="subworkflow-marker">&#9666; End sub-workflow: ${escapeHtml(sub.name)}</div>`
    : "";
  const waitHtml =
    section.kind === "wait"
      ? `<div class="link-note">Hold here${section.waitFor ? ` until <b>${escapeHtml(section.waitFor)}</b> is complete` : ""}. The line breaks at this step and picks back up once it is released.</div>`
      : "";

  return `
    <div class="section ${section.kind}">
      <div class="node-box ${kindClass}${binClass}" data-sec="${escapeHtml(section.number)}"${boxStyle(section.tag, section.kind)}>
        <div class="node-kind"><span class="section-num">${escapeHtml(section.number)}</span>${section.kind === "decision" ? ' <span class="kind-label">&middot; Decision</span>' : ""}${renderRoleHtml(section.tag)}</div>
        <div class="node-label">${renderLabelHtml(section.label, roles)}</div>
        ${renderTagsHtml(section.tag)}
        ${waitHtml}
      </div>
      ${subHtml}
      ${renderLinks(section, nextNumber)}
    </div>
  `;
}

function renderNotesHtml(notes?: WorkflowNote[]): string {
  const nonEmpty = (notes ?? []).filter((n) => n.text.trim());
  if (nonEmpty.length === 0) return "";
  return `
    <div class="notes-section">
      <h2>Notes</h2>
      ${nonEmpty.map((n) => `<div class="note-card"><p>${escapeHtml(n.text)}</p></div>`).join("")}
    </div>
  `;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
