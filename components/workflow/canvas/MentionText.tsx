import { parseLabel } from "@/lib/workflow/flow/mentions";
import type { Role } from "@/lib/workflow/flow/types";

export function MentionText({ label, roles }: { label: string; roles: Role[] }) {
  const segments = parseLabel(label);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        const role = roles.find((r) => r.id === seg.roleId);
        const color = role?.color ?? "#64748b";
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded px-1 py-0.5 text-[0.9em] font-medium"
            style={{ backgroundColor: `${color}26`, color }}
          >
            @{role?.title ?? seg.title}
          </span>
        );
      })}
    </>
  );
}
