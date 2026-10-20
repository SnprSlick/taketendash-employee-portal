// Inline role mentions are embedded in plain-text labels using the marker
// syntax @[Role Title](role:roleId) so the same string can be stored, edited,
// and rendered (canvas + PDF export) without a structured rich-text format.

export type LabelSegment = { type: "text"; value: string } | { type: "mention"; roleId: string; title: string };

const MENTION_PATTERN = /@\[([^\]]+)\]\(role:([^)]+)\)/g;

export function parseLabel(label: string): LabelSegment[] {
  const segments: LabelSegment[] = [];
  let lastIndex = 0;
  for (const match of label.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: label.slice(lastIndex, index) });
    }
    segments.push({ type: "mention", title: match[1], roleId: match[2] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < label.length) {
    segments.push({ type: "text", value: label.slice(lastIndex) });
  }
  return segments;
}

export function mentionToken(roleTitle: string, roleId: string): string {
  return `@[${roleTitle}](role:${roleId})`;
}

export function labelToPlainText(label: string): string {
  return label.replace(MENTION_PATTERN, "$1");
}
