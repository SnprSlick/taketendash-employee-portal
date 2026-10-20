"use client";

import { useState } from "react";

// Asks for the PDF's file name before exporting. Used for both the whole
// workflow and a selection of nodes.
export function ExportPdfModal({
  title,
  description,
  defaultName,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  defaultName: string;
  busy: boolean;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim().replace(/\.pdf$/i, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mb-3 text-xs text-slate-500">{description}</p>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="export-pdf-name">
          File name
        </label>
        <div className="mb-4 flex items-center gap-1">
          <input
            id="export-pdf-name"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed && !busy) onConfirm(trimmed);
              if (e.key === "Escape" && !busy) onCancel();
            }}
          />
          <span className="text-sm text-slate-400">.pdf</span>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => trimmed && onConfirm(trimmed)}
            disabled={!trimmed || busy}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
          >
            {busy ? "Generating PDF..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
