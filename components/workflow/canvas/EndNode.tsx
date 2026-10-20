import { StepNumberBadge } from "./StepNumberBadge";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import type { FlowNode, NodeActions } from "@/lib/workflow/flow/types";
import { RolePicker } from "./RolePicker";
import { BinPicker } from "./BinPicker";
import { DocumentPicker, DocumentChips } from "./DocumentPicker";
import { MentionTextarea } from "./MentionTextarea";
import { MentionText } from "./MentionText";
import { assignedColor, assignedTitle } from "@/lib/workflow/flow/assignedRoles";

type Props = NodeProps<Extract<FlowNode, { type: "end" }>> & { data: Extract<FlowNode, { type: "end" }>["data"] & NodeActions };

export function EndNode({ id, data, selected }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const accentColor = assignedColor(data, data.roles ?? [], data.groups ?? []);
  const headerTitle = assignedTitle(data, data.roles ?? [], data.groups ?? []);
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
      className={`group relative rounded-full border-2 text-white px-5 py-3 shadow-sm min-w-[160px] text-center ${
        selected ? "border-blue-400" : bin ? "" : "border-slate-900"
      }`}
      style={{
        backgroundColor: accentColor ?? "#1e293b",
        ...(bin && !selected ? { borderColor: bin.color, borderWidth: 3 } : {}),
      }}
    >
      <BinPicker
        bins={data.bins ?? []}
        locations={data.locations ?? []}
        value={data.binId}
        onChange={(binId) => data.onBinChange?.(id, binId)}
        onManageBins={data.onManageBins}
      />
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <StepNumberBadge value={data.stepNumber} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {headerTitle ?? "End"}
        </span>
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
            className="hidden rounded px-1 text-xs text-slate-400 hover:bg-red-500/20 hover:text-red-300 group-hover:block"
            title="Delete end"
          >
            ✕
          </button>
        </div>
      </div>
      <DocumentChips documents={data.documents ?? []} ids={data.documentIds ?? []} />
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
          rows={2}
        />
      ) : (
        <div onDoubleClick={() => setEditing(true)} className="cursor-text text-sm whitespace-pre-wrap">
          {data.label ? <MentionText label={data.label} roles={data.roles ?? []} /> : "Workflow complete"}
        </div>
      )}
    </div>
  );
}
