"use client";

// Floating bar shown while nodes are selected on the canvas: export just the
// selection to a PDF, or (with 2+ nodes) pull it out into a sub-workflow.
export function SelectionBar({
  count,
  onExportPdf,
  onExtract,
}: {
  count: number;
  onExportPdf: () => void;
  onExtract: () => void;
}) {
  return (
    <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          {count} {count === 1 ? "node" : "nodes"} selected
        </span>
        <button
          type="button"
          onClick={onExportPdf}
          className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900"
        >
          Export selection to PDF...
        </button>
        {count >= 2 && (
          <button
            type="button"
            onClick={onExtract}
            className="rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
          >
            Extract to Sub-Workflow...
          </button>
        )}
      </div>
    </div>
  );
}
