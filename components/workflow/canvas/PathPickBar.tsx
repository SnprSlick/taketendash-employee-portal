"use client";

import { useState } from "react";

// Floating bar shown in "Pick path" mode: nodes are toggled by plain clicks,
// then the picked set can be exported to PDF or saved as a named path.
export function PathPickBar({
  count,
  edgeCount,
  editingName,
  onClear,
  onExport,
  onSave,
  onSaveAsNew,
  onDone,
}: {
  count: number;
  edgeCount: number;
  editingName: string | null;
  onClear: () => void;
  onExport: () => void;
  onSave: (name: string) => void;
  onSaveAsNew: (name: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(editingName ?? "");
  const trimmed = name.trim();
  const disabled = count === 0;

  return (
    <div className="absolute left-1/2 top-4 z-20 w-max max-w-[95%] -translate-x-1/2 rounded-2xl border border-blue-200 bg-white px-3 py-2 shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-blue-700">
          {editingName ? `Editing "${editingName}" · ` : "Click nodes to build a path · "}
          {count} {count === 1 ? "node" : "nodes"}, {edgeCount} {edgeCount === 1 ? "line" : "lines"}
        </span>
        <span className="text-[11px] text-slate-400">Click a blue line to leave it out</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Path name"
          className="w-36 rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
        />
        {editingName ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSave(trimmed || editingName)}
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Update path
            </button>
            <button
              type="button"
              disabled={disabled || !trimmed || trimmed === editingName}
              onClick={() => onSaveAsNew(trimmed)}
              className="rounded-full border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40"
            >
              Save as new
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={disabled || !trimmed}
            onClick={() => onSaveAsNew(trimmed)}
            className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save path
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onExport}
          className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-40"
        >
          Export PDF...
        </button>
        <button type="button" disabled={disabled} onClick={onClear} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40">
          Clear
        </button>
        <button type="button" onClick={onDone} className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">
          Done
        </button>
      </div>
    </div>
  );
}
