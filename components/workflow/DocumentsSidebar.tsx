"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { WorkflowDocument } from "@/lib/workflow/flow/types";
import { NODE_COLORS } from "@/components/workflow/canvas/ColorPicker";

const DOCUMENT_COLORS = NODE_COLORS.filter((c) => c.value).map((c) => c.value as string);

export function DocumentsSidebar({
  documents,
  onDocumentsChange,
}: {
  documents: WorkflowDocument[];
  onDocumentsChange: (documents: WorkflowDocument[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function addDocument() {
    if (!name.trim()) return;
    const color = DOCUMENT_COLORS[documents.length % DOCUMENT_COLORS.length];
    onDocumentsChange([...documents, { id: nanoid(8), name: name.trim(), color }]);
    setName("");
    setCreating(false);
  }

  function updateDocument(id: string, patch: Partial<WorkflowDocument>) {
    onDocumentsChange(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function deleteDocument(id: string) {
    onDocumentsChange(documents.filter((d) => d.id !== id));
  }

  if (collapsed) {
    return (
      <div className="flex w-10 flex-col items-center border-r border-slate-200 bg-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Show documents"
        >
          <DocumentIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <DocumentIcon />
          Documents
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreating(true)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Add document"
          >
            +
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Hide documents"
          >
            &larr;
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {creating && (
          <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 shadow-sm">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name..."
              className="w-full rounded border border-transparent bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") addDocument();
                if (e.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setName("");
                }}
                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={addDocument}
                disabled={!name.trim()}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {documents.length === 0 && !creating ? (
          <div className="px-1 py-6 text-center text-sm text-slate-400">
            No documents yet.
            <button
              onClick={() => setCreating(true)}
              className="mt-2 block w-full text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
            >
              Add one
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onChange={(patch) => updateDocument(doc.id, patch)}
                onDelete={() => deleteDocument(doc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentCard({
  document,
  onChange,
  onDelete,
}: {
  document: WorkflowDocument;
  onChange: (patch: Partial<WorkflowDocument>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(document.name);

  function submit() {
    const trimmed = draft.trim();
    if (trimmed) onChange({ name: trimmed });
    else setDraft(document.name);
    setEditing(false);
  }

  return (
    <div className="group relative rounded-lg border border-slate-200 p-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-wrap gap-1">
          {NODE_COLORS.filter((c) => c.value).map((c) => (
            <button
              key={c.value}
              onClick={() => onChange({ color: c.value as string })}
              className={`h-3.5 w-3.5 rounded-full ${document.color === c.value ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}
              style={{ backgroundColor: c.value as string }}
              title={c.name}
            />
          ))}
        </div>
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setDraft(document.name);
              setEditing(false);
            }
          }}
          className="mt-1.5 w-full rounded border border-blue-300 px-1.5 py-1 text-sm text-slate-900 outline-none"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="mt-1.5 cursor-text text-sm font-medium text-slate-900"
          style={{ color: document.color }}
        >
          📄 {document.name}
        </p>
      )}
      <button
        onClick={onDelete}
        className="absolute right-1.5 top-1.5 hidden rounded px-1 text-xs text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
        title="Delete document"
      >
        ✕
      </button>
    </div>
  );
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
