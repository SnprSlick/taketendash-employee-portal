import { StepNumberBadge } from "./StepNumberBadge";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import type { FlowNode, NodeActions } from "@/lib/workflow/flow/types";
import { RolePicker } from "./RolePicker";
import { BinPicker } from "./BinPicker";
import { DocumentPicker, DocumentChips } from "./DocumentPicker";
import { MentionTextarea } from "./MentionTextarea";
import { MentionText } from "./MentionText";
import { resolveAssignedRoles, assignedColor } from "@/lib/workflow/flow/assignedRoles";

type Props = NodeProps<Extract<FlowNode, { type: "step" }>> & { data: Extract<FlowNode, { type: "step" }>["data"] & NodeActions };

export function StepNode({ id, data, selected }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const assignedRoles = resolveAssignedRoles(data, data.roles ?? [], data.groups ?? []);
  const accentColor = assignedColor(data, data.roles ?? [], data.groups ?? []);
  const bin = data.bins?.find((b) => b.id === data.binId);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.label) {
      data.onLabelChange?.(id, trimmed);
    } else {
      setDraft(data.label);
    }
  }

  return (
    <div
      className={`group relative rounded-lg border-2 bg-white px-4 py-3 shadow-sm min-w-[180px] max-w-[260px] ${
        selected ? "border-blue-500" : bin ? "" : "border-slate-300"
      }`}
      style={
        bin && !selected
          ? { borderColor: bin.color, borderWidth: 3 }
          : accentColor
            ? { borderLeftColor: accentColor, borderLeftWidth: 6 }
            : undefined
      }
    >
      <BinPicker
        bins={data.bins ?? []}
        locations={data.locations ?? []}
        value={data.binId}
        onChange={(binId) => data.onBinChange?.(id, binId)}
        onManageBins={data.onManageBins}
      />
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <StepNumberBadge value={data.stepNumber} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step</span>
        <div className="flex items-center gap-1">
          <DocumentPicker
            documents={data.documents ?? []}
            value={data.documentIds ?? []}
            onChange={(documentIds) => data.onDocumentIdsChange?.(id, documentIds)}
            onManageDocuments={data.onManageDocuments}
          />
          <RolePicker
            roles={data.roles ?? []}
            groups={data.groups ?? []}
            roleId={data.roleId}
            groupId={data.groupId}
            onChangeRole={(roleId) => data.onRoleChange?.(id, roleId)}
            onChangeGroup={(groupId) => data.onGroupChange?.(id, groupId)}
            onManageRoles={data.onManageRoles}
          />
          <button
            type="button"
            onClick={() => data.onDelete?.(id)}
            className="hidden rounded px-1 text-xs text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
            title="Delete step"
          >
            ✕
          </button>
        </div>
      </div>
      <DocumentChips documents={data.documents ?? []} ids={data.documentIds ?? []} />
      {assignedRoles.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {assignedRoles.map((role) => (
            <div
              key={role.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${role.color}1a`, color: role.color }}
            >
              {role.title}
            </div>
          ))}
        </div>
      )}
      {editing ? (
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          onCommit={commit}
          onCancel={() => {
            setDraft(data.label);
            setEditing(false);
          }}
          roles={data.roles ?? []}
          rows={3}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          className="cursor-text text-sm text-slate-900 whitespace-pre-wrap"
        >
          {data.label ? <MentionText label={data.label} roles={data.roles ?? []} /> : "Untitled step"}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}
