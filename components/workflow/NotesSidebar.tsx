"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { WorkflowNote } from "@/lib/workflow/flow/types";

export function NotesSidebar({
  notes,
  onNotesChange,
}: {
  notes: WorkflowNote[];
  onNotesChange: (notes: WorkflowNote[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  function addNote() {
    const note: WorkflowNote = { id: nanoid(8), text: "", createdAt: new Date().toISOString() };
    onNotesChange([note, ...notes]);
  }

  function updateNote(id: string, text: string) {
    onNotesChange(notes.map((n) => (n.id === id ? { ...n, text } : n)));
  }

  function deleteNote(id: string) {
    onNotesChange(notes.filter((n) => n.id !== id));
  }

  if (collapsed) {
    return (
      <div className="flex w-10 flex-col items-center border-r border-slate-200 bg-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Show notes"
        >
          <NotesIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <NotesIcon />
          Notes
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={addNote}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Add note"
          >
            +
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Hide notes"
          >
            &larr;
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {notes.length === 0 ? (
          <div className="px-1 py-6 text-center text-sm text-slate-400">
            No notes yet.
            <button
              onClick={addNote}
              className="mt-2 block w-full text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
            >
              Add one
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onChange={(text) => updateNote(note.id, text)}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  onChange,
  onDelete,
}: {
  note: WorkflowNote;
  onChange: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(!note.text.trim());
  const [draft, setDraft] = useState(note.text);

  function submit() {
    onChange(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="relative rounded-lg border border-amber-200 bg-amber-50 p-2.5 shadow-sm">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a note..."
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none nodrag"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") {
              if (!note.text.trim()) onDelete();
              else {
                setDraft(note.text);
                setEditing(false);
              }
            }
          }}
        />
        <div className="mt-1.5 flex justify-end gap-2">
          <button
            onClick={() => {
              if (!note.text.trim()) onDelete();
              else {
                setDraft(note.text);
                setEditing(false);
              }
            }}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="rounded bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-text rounded-lg border border-amber-200 bg-amber-50 p-2.5 shadow-sm"
      onClick={() => setEditing(true)}
    >
      <p className="whitespace-pre-wrap text-sm text-slate-900">{note.text}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-1.5 top-1.5 hidden rounded px-1 text-xs text-amber-400 hover:bg-red-50 hover:text-red-500 group-hover:block"
        title="Delete note"
      >
        ✕
      </button>
    </div>
  );
}

function NotesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M7 3h10a2 2 0 0 1 2 2v14l-4-3H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
