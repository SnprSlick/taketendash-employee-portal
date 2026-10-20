import { StepNumberBadge } from "./StepNumberBadge";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import type { FlowNode, NodeActions } from "@/lib/workflow/flow/types";

type Props = NodeProps<Extract<FlowNode, { type: "subworkflow" }>> & {
  data: Extract<FlowNode, { type: "subworkflow" }>["data"] & NodeActions;
};

export function SubworkflowNode({ id, data, selected }: Props) {
  const [pickerOpen, setPickerOpen] = useState(!data.refWorkflowId);
  const refWorkflow = data.subworkflows?.find((w) => w.id === data.refWorkflowId);

  return (
    <div
      className={`group relative rounded-lg border-2 border-dashed bg-violet-50 px-4 py-3 shadow-sm min-w-[200px] max-w-[280px] ${
        selected ? "border-blue-500" : "border-violet-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500" />
      <StepNumberBadge value={data.stepNumber} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-500">Sub-Workflow</span>
        <button
          type="button"
          onClick={() => data.onDelete?.(id)}
          className="hidden rounded px-1 text-xs text-violet-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {pickerOpen ? (
        <div className="nodrag flex flex-col gap-1">
          {(data.subworkflows ?? []).length === 0 ? (
            <p className="text-xs text-violet-400">
              No sub-workflows exist yet. Mark a workflow as reusable from its editor to use it here.
            </p>
          ) : (
            (data.subworkflows ?? []).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  data.onRefWorkflowChange?.(id, w.id);
                  setPickerOpen(false);
                }}
                className="rounded border border-violet-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:border-violet-400"
              >
                {w.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-slate-900">{refWorkflow?.name ?? "Untitled sub-workflow"}</div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="nodrag text-violet-600 hover:text-violet-800"
            >
              Change...
            </button>
            {data.refWorkflowId && (
              <button
                type="button"
                onClick={() => data.onOpenSubworkflow?.(data.refWorkflowId!)}
                className="nodrag text-violet-600 hover:text-violet-800"
              >
                Open →
              </button>
            )}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500" />
    </div>
  );
}
