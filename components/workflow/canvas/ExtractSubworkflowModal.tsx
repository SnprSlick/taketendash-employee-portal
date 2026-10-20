"use client";

import { useState } from "react";

export function ExtractSubworkflowModal({
  nodeCount,
  onConfirm,
  onCancel,
}: {
  nodeCount: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Extract to Sub-Workflow</h2>
        <p className="mb-3 text-xs text-slate-500">
          The {nodeCount} selected nodes will move into a new, reusable workflow. They&apos;ll be replaced here with a
          single Sub-Workflow node wired the same way.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for the new sub-workflow"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
          >
            Extract
          </button>
        </div>
      </div>
    </div>
  );
}
