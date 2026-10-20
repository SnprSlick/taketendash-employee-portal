"use client";

import { wfFetch } from "@/lib/workflow/wfFetch";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkflowSummary } from "@/lib/workflow/flow/types";
import BulkPathExportModal from "@/components/workflow/BulkPathExportModal";

// A fixed, curated palette so category colors stay legible and consistent
// across light backgrounds — assigned deterministically by name so the same
// category always gets the same color across reloads without persisting
// anything.
const CATEGORY_PALETTE = [
  { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
  { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  { text: "text-lime-700", bg: "bg-lime-50", border: "border-lime-200", dot: "bg-lime-500" },
  { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  { text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500" },
  { text: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-500" },
  { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  { text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-500" },
  { text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500" },
  { text: "text-fuchsia-700", bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500" },
  { text: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200", dot: "bg-pink-500" },
];

const UNCATEGORIZED_COLOR = { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-400" };

function categoryColor(name: string) {
  if (name === "Uncategorized") return UNCATEGORIZED_COLOR;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

export default function DashboardPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [recategorizingId, setRecategorizingId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    wfFetch("/api/workflows")
      .then((res) => res.json())
      .then((data) => setWorkflows(data))
      .finally(() => setLoading(false));
  }, []);

  const grouped = workflows.reduce<Record<string, WorkflowSummary[]>>((acc, w) => {
    const key = w.category || "Uncategorized";
    acc[key] = acc[key] || [];
    acc[key].push(w);
    return acc;
  }, {});

  async function handleCreate() {
    const res = await wfFetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Untitled workflow", category: category || null }),
    });
    const workflow = await res.json();
    router.push(`/workflows/${workflow.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    const res = await wfFetch(`/api/workflows/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const names = body?.referencedBy?.map((w: { name: string }) => w.name).join(", ");
      alert(names ? `Can't delete — used as a sub-workflow in: ${names}` : "Failed to delete workflow.");
      return;
    }
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }

  function startRecategorize(w: WorkflowSummary) {
    setRecategorizingId(w.id);
    setCategoryDraft(w.category ?? "");
  }

  async function submitRecategorize(id: string) {
    const nextCategory = categoryDraft.trim() || null;
    setRecategorizingId(null);
    await wfFetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: nextCategory }),
    });
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, category: nextCategory } : w)));
  }

  const existingCategories = Array.from(new Set(workflows.map((w) => w.category).filter(Boolean))) as string[];

  return (
    <div className="min-h-full bg-slate-50">
      {bulkExportOpen && <BulkPathExportModal onClose={() => setBulkExportOpen(false)} />}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              Document Control Workflows
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">
              Visual step-by-step guides for how documents should be handled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkExportOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Bulk export paths
            </button>
            <button
              onClick={() => setCreating(true)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              + New Workflow
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {creating && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2.5 text-sm font-semibold text-slate-700">New workflow</h2>
            <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workflow name (e.g. Tire & Wheel Shipments)"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category (optional)"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create & Open
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-slate-400">Loading workflows...</p>}

        {!loading && workflows.length === 0 && !creating && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <p className="text-sm text-slate-500">No workflows yet.</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
            >
              Create your first one
            </button>
          </div>
        )}

        {Object.entries(grouped).map(([category, items]) => {
          const color = categoryColor(category);
          return (
            <div key={category} className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{category}</h2>
                <span className="text-[11px] text-slate-300">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((w) => (
                  <div
                    key={w.id}
                    className={`group flex flex-col rounded-lg border bg-white py-2.5 pl-3 pr-2.5 shadow-sm transition hover:shadow-md ${color.border}`}
                    style={{ borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button onClick={() => router.push(`/workflows/${w.id}`)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate text-sm font-medium text-slate-900">{w.name}</div>
                          {w.isTemplate && (
                            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                              Reusable
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span className={`rounded px-1.5 py-0.5 font-medium ${color.bg} ${color.text}`}>{category}</span>
                          <span>{new Date(w.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </div>

                    {recategorizingId === w.id ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          autoFocus
                          list="category-suggestions"
                          value={categoryDraft}
                          onChange={(e) => setCategoryDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRecategorize(w.id);
                            if (e.key === "Escape") setRecategorizingId(null);
                          }}
                          placeholder="Category (leave blank to uncategorize)"
                          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400"
                        />
                        <button
                          onClick={() => submitRecategorize(w.id)}
                          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRecategorizingId(null)}
                          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRecategorize(w)}
                        className="mt-1 self-start text-[11px] text-slate-300 opacity-0 transition hover:text-slate-600 group-hover:opacity-100"
                      >
                        Move to category...
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
      <datalist id="category-suggestions">
        {existingCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
