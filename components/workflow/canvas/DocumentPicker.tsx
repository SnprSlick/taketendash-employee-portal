"use client";

import { useState } from "react";
import type { WorkflowDocument } from "@/lib/workflow/flow/types";

export function DocumentPicker({
  documents,
  value,
  onChange,
  onManageDocuments,
}: {
  documents: WorkflowDocument[];
  value: string[];
  onChange: (documentIds: string[]) => void;
  onManageDocuments?: () => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(docId: string) {
    onChange(value.includes(docId) ? value.filter((id) => id !== docId) : [...value, docId]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="nodrag rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        title="Documents at this step"
      >
        📄 {value.length > 0 ? value.length : "+"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="nodrag absolute right-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            {documents.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-slate-400">No documents yet.</p>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggle(doc.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                >
                  <input type="checkbox" readOnly checked={value.includes(doc.id)} className="pointer-events-none" />
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: doc.color }} />
                  <span className="truncate">{doc.name}</span>
                </button>
              ))
            )}
            {onManageDocuments && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onManageDocuments();
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50"
                >
                  Manage documents...
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DocumentChips({ documents, ids }: { documents: WorkflowDocument[]; ids: string[] }) {
  const active = documents.filter((d) => ids.includes(d.id));
  if (active.length === 0) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {active.map((doc) => (
        <div
          key={doc.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${doc.color}1a`, color: doc.color }}
        >
          📄 {doc.name}
        </div>
      ))}
    </div>
  );
}
