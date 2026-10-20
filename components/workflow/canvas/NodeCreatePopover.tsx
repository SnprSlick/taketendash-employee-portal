"use client";

import { useState } from "react";

export type NewNodeType = "start" | "step" | "decision" | "end" | "subworkflow" | "wait";

export function NodeCreatePopover({
  screenPosition,
  onCreate,
  onCancel,
}: {
  screenPosition: { x: number; y: number };
  onCreate: (type: NewNodeType, label: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<NewNodeType>("step");
  const [label, setLabel] = useState("");

  if (type === "subworkflow") {
    return (
      <div
        className="fixed z-50 w-72 rounded-lg border border-slate-300 bg-white p-3 shadow-lg"
        style={{ left: screenPosition.x, top: screenPosition.y }}
      >
        <div className="mb-2 flex flex-wrap gap-1">
          {(["start", "step", "decision", "end", "subworkflow", "wait"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                type === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t === "subworkflow" ? "Sub-workflow" : t}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Adds a placeholder node — pick which sub-workflow it runs after it's created.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded px-3 py-1 text-xs text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate(type, "Sub-workflow")}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
          >
            Add node
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 w-72 rounded-lg border border-slate-300 bg-white p-3 shadow-lg"
      style={{ left: screenPosition.x, top: screenPosition.y }}
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {(["start", "step", "decision", "end", "subworkflow", "wait"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded px-2 py-1 text-xs font-medium capitalize ${
              type === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t === "subworkflow" ? "Sub-workflow" : t}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={
          type === "decision"
            ? "What's the question? e.g. Is this a stock item?"
            : type === "end"
              ? "How does the workflow end?"
              : type === "start"
                ? "What kicks off this workflow?"
                : type === "wait"
                  ? "What is this branch waiting on? (optional)"
                  : "What should the worker do?"
        }
        className="w-full resize-none rounded border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onCreate(type, label.trim());
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() => onCreate(type, label.trim())}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Add node
        </button>
      </div>
    </div>
  );
}
