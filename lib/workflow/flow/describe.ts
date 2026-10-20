import { assignedTitle, resolveAssignedRoles } from "./assignedRoles";
import { computeDocumentPresence } from "./documents";
import { buildAdjacency, edgeLabel, getWaitSignalSource } from "./lanes";
import { labelToPlainText } from "./mentions";
import { analyzeFlow, comparePaths, formatStepNumber } from "./numbering";
import type {
  Bin,
  DecisionNodeData,
  FlowEdge,
  FlowNode,
  Location,
  Role,
  RoleGroup,
  WorkflowRecord,
} from "./types";

// Read-only description layer used by the MCP server. Everything here is a
// pure function of a workflow plus the shared reference data (roles, groups,
// bins, locations), so the model sees the same numbering, document routing,
// and merge/loop logic that the editor, walkthrough and PDF export use.

export type Reference = {
  roles: Role[];
  groups: RoleGroup[];
  bins: Bin[];
  locations: Location[];
  // Looks up another workflow (for sub-workflow nodes).
  lookupWorkflow: (id: string) => { id: string; name: string } | undefined;
};

export type NodeLink = {
  to: string; // step number of the target
  toLabel: string;
  answer: string | null; // decision choice leading here (null for a plain "next")
  loopBack: boolean; // true if this edge returns to an earlier step
  documents: string[]; // documents that continue along this link
};

export type NodeDescription = {
  number: string;
  id: string;
  type: FlowNode["type"];
  label: string;
  assignedTo: { kind: "role" | "group"; title: string; roles: string[] } | null;
  bin: { name: string; location: string | null; locationLetter: string | null } | null;
  // documents explicitly attached to this node (the rest arrive from earlier nodes)
  documentsIntroduced: string[];
  documentsPresent: string[];
  next: NodeLink[];
  parallelNext: boolean; // several next links that all run at once (non-decision fan-out)
  reachedFrom: { from: string; answer: string | null; loopBack: boolean }[];
  isMerge: boolean; // several forward paths converge here
  waitsFor: string | null; // wait node: step number whose completion unblocks it
  subWorkflow: { id: string | null; name: string | null } | null;
  documentRouting: { document: string; continuesOn: string[]; stopsOn: string[] }[];
  isDeadEnd: boolean;
};

export type WorkflowModel = {
  workflow: WorkflowRecord;
  numberOf: (nodeId: string) => string;
  nodeByNumber: Map<string, FlowNode>;
  describe: (node: FlowNode) => NodeDescription;
  ordered: FlowNode[]; // nodes in number order
  analysis: ReturnType<typeof analyzeFlow>;
  presence: Map<string, string[]>; // nodeId -> document names present
};

export function buildModel(workflow: WorkflowRecord, ref: Reference): WorkflowModel {
  const { nodes, edges } = workflow;
  const analysis = analyzeFlow(nodes, edges);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const docsById = new Map((workflow.documents ?? []).map((d) => [d.id, d]));
  const outgoing = buildAdjacency(edges);
  const presenceDocs = computeDocumentPresence(nodes, edges, workflow.documents ?? []);
  const presence = new Map<string, string[]>();
  presenceDocs.forEach((docs, id) => presence.set(id, docs.map((d) => d.name)));

  const numberOf = (nodeId: string) => {
    const p = analysis.paths.get(nodeId);
    return p ? formatStepNumber(p) : "unnumbered";
  };

  const ordered = [...nodes].sort((a, b) => {
    const pa = analysis.paths.get(a.id);
    const pb = analysis.paths.get(b.id);
    if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
    return comparePaths(pa, pb);
  });
  const nodeByNumber = new Map(ordered.map((n) => [numberOf(n.id), n]));

  const plain = (label: string) => labelToPlainText(label ?? "").replace(/\s+/g, " ").trim();

  function assignment(node: FlowNode): NodeDescription["assignedTo"] {
    if (node.type === "subworkflow") return null;
    const data = node.data as { roleId?: string; groupId?: string };
    const title = assignedTitle(data, ref.roles, ref.groups);
    if (!title) return null;
    return {
      kind: data.groupId ? "group" : "role",
      title,
      roles: resolveAssignedRoles(data, ref.roles, ref.groups).map((r) => r.title),
    };
  }

  function binOf(node: FlowNode): NodeDescription["bin"] {
    if (node.type === "subworkflow") return null;
    const binId = (node.data as { binId?: string }).binId;
    const bin = binId ? ref.bins.find((b) => b.id === binId) : undefined;
    if (!bin) return null;
    const loc = ref.locations.find((l) => l.id === bin.locationId);
    return { name: bin.name, location: loc?.name ?? null, locationLetter: loc?.letter ?? null };
  }

  // Which of the documents present at a decision continue down a given branch.
  function docsOnBranch(node: FlowNode, branchIndex: number | undefined): string[] {
    const present = presence.get(node.id) ?? [];
    if (node.type !== "decision" || branchIndex === undefined) return present;
    const routing = (node.data as DecisionNodeData).documentRouting ?? {};
    return present.filter((name) => {
      const doc = [...docsById.values()].find((d) => d.name === name);
      const allowed = doc ? routing[doc.id] : undefined;
      return !allowed || allowed.includes(branchIndex);
    });
  }

  function describe(node: FlowNode): NodeDescription {
    const outs = (outgoing.get(node.id) ?? []).filter((e) => nodesById.has(e.target));
    const isDecision = node.type === "decision";

    const next: NodeLink[] = outs.map((edge: FlowEdge) => {
      const branchIndex = edge.sourceHandle?.startsWith("branch-") ? Number(edge.sourceHandle.slice(7)) : undefined;
      const target = nodesById.get(edge.target)!;
      return {
        to: numberOf(edge.target),
        toLabel: plain(target.data.label),
        answer: isDecision ? edgeLabel(edge) : null,
        loopBack: analysis.backEdgeIds.has(edge.id),
        documents: docsOnBranch(node, isDecision ? branchIndex : undefined),
      };
    });

    const reachedFrom = edges
      .filter((e) => e.target === node.id && e.targetHandle !== "signal-in" && nodesById.has(e.source))
      .map((e) => {
        const src = nodesById.get(e.source)!;
        return {
          from: numberOf(e.source),
          answer: src.type === "decision" ? edgeLabel(e) : null,
          loopBack: analysis.backEdgeIds.has(e.id),
        };
      });

    const routing: NodeDescription["documentRouting"] = [];
    if (isDecision) {
      const data = node.data as DecisionNodeData;
      const branchNames = data.branches ?? [];
      Object.entries(data.documentRouting ?? {}).forEach(([docId, allowed]) => {
        const doc = docsById.get(docId);
        if (!doc) return;
        routing.push({
          document: doc.name,
          continuesOn: allowed.map((i) => branchNames[i]).filter(Boolean),
          stopsOn: branchNames.filter((_, i) => !allowed.includes(i)),
        });
      });
    }

    const waitSource = node.type === "wait" ? getWaitSignalSource(edges, node.id) : undefined;
    let subWorkflow: NodeDescription["subWorkflow"] = null;
    if (node.type === "subworkflow") {
      const refId = node.data.refWorkflowId ?? null;
      subWorkflow = { id: refId, name: refId ? (ref.lookupWorkflow(refId)?.name ?? null) : null };
    }

    const introduced = ("documentIds" in node.data ? (node.data.documentIds ?? []) : [])
      .map((id) => docsById.get(id)?.name)
      .filter((n): n is string => Boolean(n));

    return {
      number: numberOf(node.id),
      id: node.id,
      type: node.type as FlowNode["type"],
      label: plain(node.data.label),
      assignedTo: assignment(node),
      bin: binOf(node),
      documentsIntroduced: introduced,
      documentsPresent: presence.get(node.id) ?? [],
      next,
      parallelNext: !isDecision && next.length > 1,
      reachedFrom,
      isMerge: (analysis.parents.get(node.id) ?? []).length > 1,
      waitsFor: waitSource ? numberOf(waitSource) : null,
      subWorkflow,
      documentRouting: routing,
      isDeadEnd: node.type === "end" || next.length === 0,
    };
  }

  return { workflow, numberOf, nodeByNumber, describe, ordered, analysis, presence };
}

// ---------------------------------------------------------------- markdown

const TYPE_LABEL: Record<string, string> = {
  start: "Start",
  step: "Step",
  decision: "Decision",
  end: "End",
  subworkflow: "Sub-workflow",
  wait: "Wait",
};

export function renderNode(d: NodeDescription): string {
  const lines: string[] = [];
  lines.push(`### ${d.number} · ${TYPE_LABEL[d.type] ?? d.type} — ${d.label || "(untitled)"}`);
  lines.push(`- node id: \`${d.id}\``);
  if (d.assignedTo) {
    const roles = d.assignedTo.kind === "group" ? ` (roles: ${d.assignedTo.roles.join(", ") || "none"})` : "";
    lines.push(`- responsible: ${d.assignedTo.title} [${d.assignedTo.kind}]${roles}`);
  }
  if (d.bin) {
    lines.push(`- bin: ${d.bin.name}${d.bin.location ? ` — ${d.bin.locationLetter} · ${d.bin.location}` : ""}`);
  }
  if (d.documentsIntroduced.length) lines.push(`- documents attached here: ${d.documentsIntroduced.join(", ")}`);
  if (d.documentsPresent.length) lines.push(`- documents present here: ${d.documentsPresent.join(", ")}`);
  if (d.subWorkflow) {
    lines.push(
      `- runs sub-workflow: ${d.subWorkflow.name ?? "(missing)"}${d.subWorkflow.id ? ` (id \`${d.subWorkflow.id}\`)` : ""}`,
    );
  }
  if (d.waitsFor) lines.push(`- WAIT: this branch pauses until ${d.waitsFor} is reached on another branch`);
  if (d.isMerge) lines.push(`- merge point: several paths converge here (${d.reachedFrom.map((r) => r.from).join(", ")})`);
  else if (d.reachedFrom.length) {
    lines.push(
      `- reached from: ${d.reachedFrom.map((r) => `${r.from}${r.answer ? ` (answer "${r.answer}")` : ""}${r.loopBack ? " [loop-back]" : ""}`).join(", ")}`,
    );
  }
  if (d.documentRouting.length) {
    d.documentRouting.forEach((r) =>
      lines.push(`- document routing: ${r.document} continues only on ${r.continuesOn.join(", ") || "no branch"}; stops on ${r.stopsOn.join(", ") || "none"}`),
    );
  }
  if (d.type === "decision") {
    const byAnswer = new Map<string, NodeLink[]>();
    d.next.forEach((l) => byAnswer.set(l.answer ?? "", [...(byAnswer.get(l.answer ?? "") ?? []), l]));
    lines.push("- choices:");
    byAnswer.forEach((links, answer) => {
      const targets = links.map((l) => `${l.to} ${l.toLabel ? `"${l.toLabel}"` : ""}${l.loopBack ? " [loop-back]" : ""}`.trim());
      const docs = links[0].documents;
      lines.push(
        `  - **${answer}** → ${targets.join(" AND ")}${links.length > 1 ? " (in parallel)" : ""}${docs.length ? ` — documents continuing: ${docs.join(", ")}` : ""}`,
      );
    });
  } else if (d.isDeadEnd) {
    lines.push(`- ${d.type === "end" ? "END of this path" : "dead end: no outgoing connection"}`);
  } else {
    const targets = d.next.map((l) => `${l.to} "${l.toLabel}"${l.loopBack ? " [loop-back]" : ""}`);
    lines.push(`- next: ${targets.join(d.parallelNext ? " AND (in parallel) " : "")}`);
  }
  return lines.join("\n");
}

export function renderOverview(m: WorkflowModel): string {
  const w = m.workflow;
  const all = m.ordered.map(m.describe);
  const count = (t: string) => all.filter((d) => d.type === t).length;
  const lines: string[] = [];
  lines.push(`# ${w.name}`);
  lines.push(`- id: \`${w.id}\`${w.category ? ` · category: ${w.category}` : ""}${w.isTemplate ? " · reusable sub-workflow/template" : ""}`);
  if (w.description) lines.push(`- description: ${w.description}`);
  lines.push(
    `- ${all.length} nodes: ${count("start")} start, ${count("step")} steps, ${count("decision")} decisions, ${count("end")} ends, ${count("wait")} waits, ${count("subworkflow")} sub-workflows; ${w.edges.length} connections`,
  );
  lines.push(`- numbering: each node has a #.#.# number — first = start point, middle = step order, last = split branch (0 = not on a split). Use these numbers with the other tools.`);

  const starts = all.filter((d) => d.type === "start");
  lines.push("\n## Entry points");
  starts.forEach((d) => lines.push(`- ${d.number} — ${d.label}${d.assignedTo ? ` (${d.assignedTo.title})` : ""} · \`${d.id}\``));

  lines.push("\n## Documents");
  if ((w.documents ?? []).length === 0) lines.push("- none defined");
  (w.documents ?? []).forEach((doc) => {
    const attached = all.filter((d) => d.documentsIntroduced.includes(doc.name)).map((d) => d.number);
    const present = all.filter((d) => d.documentsPresent.includes(doc.name));
    lines.push(
      `- **${doc.name}** — first appears at ${present[0]?.number ?? "(nowhere)"}; explicitly attached at ${attached.length} node(s) (${attached.slice(0, 8).join(", ")}${attached.length > 8 ? ", …" : ""}); present at ${present.length} nodes; finishes at ${
        present.filter((d) => d.isDeadEnd).map((d) => d.number).join(", ") || "(no end)"
      }`,
    );
  });

  lines.push("\n## Who does what");
  const byRole = new Map<string, string[]>();
  all.forEach((d) => {
    if (d.assignedTo) byRole.set(d.assignedTo.title, [...(byRole.get(d.assignedTo.title) ?? []), d.number]);
  });
  byRole.forEach((nums, title) => lines.push(`- ${title}: ${nums.length} nodes (${nums.slice(0, 12).join(", ")}${nums.length > 12 ? ", …" : ""})`));
  const unassigned = all.filter((d) => !d.assignedTo && !["subworkflow"].includes(d.type));
  if (unassigned.length) lines.push(`- (no role assigned): ${unassigned.map((d) => d.number).join(", ")}`);

  lines.push("\n## Handoffs between roles");
  let handoffs = 0;
  all.forEach((d) =>
    d.next.forEach((l) => {
      const target = m.nodeByNumber.get(l.to);
      const to = target ? m.describe(target).assignedTo?.title : undefined;
      if (d.assignedTo && to && d.assignedTo.title !== to && handoffs < 25) {
        handoffs++;
        lines.push(`- ${d.number} (${d.assignedTo.title}) → ${l.to} (${to})${l.answer ? ` on "${l.answer}"` : ""}`);
      }
    }),
  );
  if (handoffs === 0) lines.push("- none");

  const decisions = all.filter((d) => d.type === "decision");
  lines.push(`\n## Decisions (${decisions.length})`);
  decisions.forEach((d) => {
    const answers = [...new Set(d.next.map((l) => l.answer))].join(" / ");
    lines.push(`- ${d.number} — ${d.label} → ${answers}`);
  });

  const merges = all.filter((d) => d.isMerge);
  if (merges.length) lines.push(`\n## Merge points\n${merges.map((d) => `- ${d.number} ← ${d.reachedFrom.map((r) => r.from).join(", ")}`).join("\n")}`);
  const loops = all.flatMap((d) => d.next.filter((l) => l.loopBack).map((l) => `- ${d.number} → ${l.to}${l.answer ? ` (on "${l.answer}")` : ""}`));
  if (loops.length) lines.push(`\n## Loops (return to an earlier step)\n${loops.join("\n")}`);
  const waits = all.filter((d) => d.type === "wait");
  if (waits.length) lines.push(`\n## Wait points\n${waits.map((d) => `- ${d.number} waits for ${d.waitsFor ?? "(unwired)"}`).join("\n")}`);
  const subs = all.filter((d) => d.subWorkflow);
  if (subs.length) lines.push(`\n## Sub-workflows used\n${subs.map((d) => `- ${d.number} → ${d.subWorkflow!.name ?? "(missing)"} (id \`${d.subWorkflow!.id ?? ""}\`)`).join("\n")}`);

  const notes = (w.notes ?? []).filter((n) => n.text.trim());
  if (notes.length) lines.push(`\n## Notes\n${notes.map((n) => `- ${n.text.trim().replace(/\n/g, " ")}`).join("\n")}`);
  return lines.join("\n");
}

// Indented decision tree from a node. A node already printed (a merge or a
// loop target) is shown as a reference instead of being repeated.
export function renderTree(m: WorkflowModel, fromNodeId: string, maxDepth = 200): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const nodesById = new Map(m.workflow.nodes.map((n) => [n.id, n]));

  function line(d: NodeDescription): string {
    const who = d.assignedTo ? ` {${d.assignedTo.title}}` : "";
    const bin = d.bin ? ` [bin: ${d.bin.name}]` : "";
    const wait = d.waitsFor ? ` (waits for ${d.waitsFor})` : "";
    return `${d.number} ${TYPE_LABEL[d.type] ?? d.type}: ${d.label}${who}${bin}${wait}`;
  }

  function visit(node: FlowNode, indent: string, depth: number) {
    const d = m.describe(node);
    if (seen.has(node.id)) {
      out.push(`${indent}↪ see ${d.number}`);
      return;
    }
    seen.add(node.id);
    out.push(`${indent}${line(d)}`);
    if (depth >= maxDepth) return;
    if (d.type === "decision") {
      const byAnswer = new Map<string, NodeLink[]>();
      d.next.forEach((l) => byAnswer.set(l.answer ?? "", [...(byAnswer.get(l.answer ?? "") ?? []), l]));
      byAnswer.forEach((links, answer) => {
        out.push(`${indent}  ├─ if "${answer}"${links.length > 1 ? " (parallel)" : ""}:`);
        links.forEach((l) => {
          const target = m.workflow.nodes.find((n) => m.numberOf(n.id) === l.to);
          if (target) visit(target, `${indent}  │   `, depth + 1);
        });
      });
    } else {
      const links = d.next;
      if (d.parallelNext) out.push(`${indent}  ├─ (parallel):`);
      links.forEach((l) => {
        const target = nodesById.get(
          m.workflow.nodes.find((n) => m.numberOf(n.id) === l.to)?.id ?? "",
        );
        if (target) visit(target, d.parallelNext ? `${indent}  │   ` : indent, depth + 1);
      });
    }
  }

  const start = nodesById.get(fromNodeId);
  if (start) visit(start, "", 0);
  return out.join("\n");
}

// Follows one document through the workflow: where it appears, which
// decisions let it through or stop it, and where it ends up.
export function renderDocumentTrace(m: WorkflowModel, documentName: string): string | null {
  const doc = (m.workflow.documents ?? []).find((d) => d.name.toLowerCase() === documentName.toLowerCase());
  if (!doc) return null;
  const all = m.ordered.map(m.describe);
  const present = all.filter((d) => d.documentsPresent.includes(doc.name));
  const origin = all.filter((d) => d.documentsIntroduced.includes(doc.name));
  const lines: string[] = [`# Document: ${doc.name}`];
  lines.push(`- first appears at: ${present[0] ? `${present[0].number} "${present[0].label}"` : "(not attached anywhere)"}`);
  lines.push(`- explicitly attached at: ${origin.map((d) => `${d.number} "${d.label}"`).join("; ") || "(nowhere)"}`);
  lines.push(`- present at ${present.length} of ${all.length} nodes`);

  const stops = all.filter((d) => d.documentRouting.some((r) => r.document === doc.name));
  if (stops.length) {
    lines.push("\n## Decisions that route this document");
    stops.forEach((d) => {
      const r = d.documentRouting.find((x) => x.document === doc.name)!;
      lines.push(`- ${d.number} "${d.label}": continues on ${r.continuesOn.join(", ") || "no branch"}; does NOT continue on ${r.stopsOn.join(", ") || "none"}`);
    });
  }

  lines.push("\n## Nodes it reaches (in number order; parallel branches interleave, so follow the numbers, not the list order)");
  present.forEach((d) => {
    const bin = d.bin ? ` → placed in bin "${d.bin.name}"` : "";
    const who = d.assignedTo ? ` — ${d.assignedTo.title}` : "";
    lines.push(`- ${d.number} ${TYPE_LABEL[d.type]}: ${d.label}${who}${bin}`);
  });

  const ends = present.filter((d) => d.isDeadEnd);
  lines.push("\n## Where it finishes");
  if (ends.length === 0) lines.push("- no end reached");
  ends.forEach((d) => lines.push(`- ${d.number} ${d.label}${d.bin ? ` (bin "${d.bin.name}")` : ""}`));
  const bins = [...new Set(present.filter((d) => d.bin).map((d) => d.bin!.name))];
  lines.push(`\n## Bins touched\n${bins.length ? bins.map((b) => `- ${b}`).join("\n") : "- none"}`);
  return lines.join("\n");
}

// Enumerates distinct forward paths between two nodes (loop-backs excluded),
// labelling decision answers, capped so merges can't explode the output.
export function findPaths(m: WorkflowModel, fromId: string, toId: string, limit = 10): { paths: string[]; truncated: boolean } {
  const results: string[] = [];
  let truncated = false;
  const nodesByNumber = m.nodeByNumber;
  const stack: string[] = [];

  function dfs(node: FlowNode, trail: string[]) {
    if (results.length >= limit) {
      truncated = true;
      return;
    }
    if (stack.includes(node.id)) return;
    stack.push(node.id);
    const d = m.describe(node);
    const here = `${d.number}`;
    if (node.id === toId) {
      results.push([...trail, here].join(" → "));
    } else {
      d.next
        .filter((l) => !l.loopBack)
        .forEach((l) => {
          const target = nodesByNumber.get(l.to);
          if (target) dfs(target, [...trail, `${here}${l.answer ? ` [${l.answer}]` : ""}`]);
        });
    }
    stack.pop();
  }
  const start = m.workflow.nodes.find((n) => n.id === fromId);
  if (start) dfs(start, []);
  return { paths: results, truncated };
}
