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

type Props = NodeProps<Extract<FlowNode, { type: "decision" }>> & {
  data: Extract<FlowNode, { type: "decision" }>["data"] & NodeActions;
};

export function DecisionNode({ id, data, selected }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const [editingBranch, setEditingBranch] = useState<number | null>(null);
  const [branchDraft, setBranchDraft] = useState("");
  const accentColor = assignedColor(data, data.roles ?? [], data.groups ?? []);
  const headerTitle = assignedTitle(data, data.roles ?? [], data.groups ?? []);
  const bin = data.bins?.find((b) => b.id === data.binId);
  const incomingDocuments = (data.documents ?? []).filter((d) => data.incomingDocumentIds?.includes(d.id));

  const branches = data.branches?.length ? data.branches : ["Yes", "No"];

  function commitLabel() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.label) {
      data.onLabelChange?.(id, trimmed);
    } else {
      setDraft(data.label);
    }
  }

  function commitBranch(index: number) {
    const trimmed = branchDraft.trim();
    setEditingBranch(null);
    if (!trimmed) return;
    const next = [...branches];
    next[index] = trimmed;
    data.onBranchesChange?.(id, next);
  }

  function addBranch() {
    data.onBranchesChange?.(id, [...branches, `Option ${branches.length + 1}`]);
  }

  function removeBranch(index: number) {
    if (branches.length <= 1) return;
    data.onBranchesChange?.(
      id,
      branches.filter((_, i) => i !== index),
    );
  }

  const filled = Boolean(accentColor);
  const labelTextClass = filled ? "text-white" : "text-slate-900";
  const headerTextClass = filled ? "text-white/80" : "text-amber-600";
  const branchTextClass = filled ? "text-white" : "text-amber-700";
  const branchHoverClass = filled ? "text-white/70 hover:text-red-200" : "text-amber-400 hover:text-red-500";
  const addBranchClass = filled ? "text-white/80 hover:text-white" : "text-amber-500 hover:text-amber-700";
  const deleteBtnClass = filled
    ? "text-white/70 hover:bg-white/10 hover:text-red-200"
    : "text-amber-400 hover:bg-red-50 hover:text-red-500";
  const handleClass = filled ? "!bg-white" : "!bg-amber-500";

  return (
    <div
      className={`group relative rounded-lg border-2 px-4 py-3 shadow-sm min-w-[220px] max-w-[300px] ${
        filled ? "" : "bg-amber-50"
      } ${
        selected
          ? "border-blue-500"
          : bin
            ? ""
            : filled
              ? "border-transparent"
              : "border-amber-400"
      }`}
      style={{
        ...(filled ? { backgroundColor: accentColor! } : {}),
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
      <Handle type="target" position={Position.Top} className={handleClass} />
      <StepNumberBadge value={data.stepNumber} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${headerTextClass}`}>
          {filled ? headerTitle : "Decision (If)"}
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
            className={`hidden rounded px-1 text-xs group-hover:block ${deleteBtnClass}`}
            title="Delete decision"
          >
            ✕
          </button>
        </div>
      </div>

      <DocumentChips documents={data.documents ?? []} ids={data.documentIds ?? []} />

      {editing ? (
        <div className="mb-2">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onCommit={commitLabel}
            onCancel={() => {
              setDraft(data.label);
              setEditing(false);
            }}
            roles={data.roles ?? []}
            rows={2}
          />
        </div>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          className={`cursor-text text-sm whitespace-pre-wrap mb-2 ${labelTextClass}`}
        >
          {data.label ? <MentionText label={data.label} roles={data.roles ?? []} /> : "Untitled decision"}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-x-1 gap-y-3">
        {branches.map((branch, i) => (
          <div key={i} className="group/branch relative flex-1 min-w-[64px] text-center">
            {editingBranch === i ? (
              <input
                autoFocus
                value={branchDraft}
                onChange={(e) => setBranchDraft(e.target.value)}
                onBlur={() => commitBranch(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitBranch(i);
                  if (e.key === "Escape") setEditingBranch(null);
                }}
                className="w-full rounded border border-blue-300 px-1 text-[11px] text-slate-900 outline-none nodrag"
              />
            ) : (
              <button
                type="button"
                onDoubleClick={() => {
                  setEditingBranch(i);
                  setBranchDraft(branch);
                }}
                className={`text-[11px] font-medium ${branchTextClass}`}
                title="Double-click to rename"
              >
                {branch}
              </button>
            )}
            {branches.length > 1 && (
              <button
                type="button"
                onClick={() => removeBranch(i)}
                className={`ml-1 hidden text-[10px] group-hover/branch:inline ${branchHoverClass}`}
                title="Remove branch"
              >
                ✕
              </button>
            )}
            <Handle
              type="source"
              position={Position.Bottom}
              id={`branch-${i}`}
              style={{ left: `${((i + 0.5) / branches.length) * 100}%` }}
              className={handleClass}
            />
          </div>
        ))}
        <button type="button" onClick={addBranch} className={`text-[11px] ${addBranchClass}`} title="Add branch">
          + branch
        </button>
      </div>

      {incomingDocuments.length > 0 && (
        <div className="nodrag mt-3 border-t border-white/20 pt-2">
          <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${headerTextClass}`}>
            Document routing
          </div>
          <div className="flex flex-col gap-1.5">
            {incomingDocuments.map((doc) => {
              const allowed = data.documentRouting?.[doc.id] ?? branches.map((_, i) => i);
              return (
                <div key={doc.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${doc.color}2a`, color: filled ? "#fff" : doc.color }}
                  >
                    📄 {doc.name}
                  </span>
                  <div className="flex gap-1">
                    {branches.map((branch, i) => {
                      const isAllowed = allowed.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const next = isAllowed ? allowed.filter((b) => b !== i) : [...allowed, i];
                            data.onDocumentRoutingChange?.(id, { ...data.documentRouting, [doc.id]: next });
                          }}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isAllowed
                              ? filled
                                ? "bg-white/25 text-white"
                                : "bg-amber-200 text-amber-800"
                              : filled
                                ? "bg-white/5 text-white/40"
                                : "bg-white text-slate-300"
                          }`}
                          title={`${branch}: ${isAllowed ? "document continues" : "document stops"}`}
                        >
                          {branch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
