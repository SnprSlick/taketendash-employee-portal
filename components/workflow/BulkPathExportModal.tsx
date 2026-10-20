"use client";

import { wfFetch } from "@/lib/workflow/wfFetch";
import { useEffect, useMemo, useState } from "react";
import type { WorkflowPathRecord } from "@/lib/workflow/flow/paths";

type PathWithWorkflow = WorkflowPathRecord & { workflowName: string };

// Minimal typing for the File System Access API (Chromium browsers).
type DirHandle = {
  getFileHandle: (name: string, opts: { create: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};
type DirectoryPicker = (opts?: { mode?: "readwrite" }) => Promise<DirHandle>;

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim() || "path";

// Pick saved paths from every workflow, choose a folder, and export one PDF per path.
export default function BulkPathExportModal({ onClose }: { onClose: () => void }) {
  const [paths, setPaths] = useState<PathWithWorkflow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    wfFetch("/api/paths")
      .then((res) => res.json())
      .then(setPaths)
      .catch(() => setPaths([]));
  }, []);

  const byWorkflow = useMemo(() => {
    const map = new Map<string, PathWithWorkflow[]>();
    (paths ?? []).forEach((p) => map.set(p.workflowName, [...(map.get(p.workflowName) ?? []), p]));
    return [...map.entries()];
  }, [paths]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  async function exportSelected() {
    const chosen = (paths ?? []).filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;
    setMessage("");
    // Ask where to save first (needs the click's user gesture). Browsers
    // without folder access fall back to normal downloads.
    const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
    let dir: DirHandle | null = null;
    if (picker) {
      try {
        dir = await picker.call(window, { mode: "readwrite" });
      } catch {
        return; // cancelled
      }
    }
    setBusy(true);
    const used = new Map<string, number>();
    const failed: string[] = [];
    try {
      for (let i = 0; i < chosen.length; i++) {
        const path = chosen[i];
        setProgress(`Exporting ${i + 1} of ${chosen.length}: ${path.name}`);
        const base = safeName(path.name);
        const count = (used.get(base) ?? 0) + 1;
        used.set(base, count);
        const fileName = count > 1 ? `${base} (${count})` : base;
        const res = await wfFetch(`/api/workflows/${path.workflowId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeIds: path.nodeIds, edgeIds: path.edgeIds ?? undefined, fileName, title: path.name }),
        });
        if (!res.ok) {
          failed.push(path.name);
          continue;
        }
        const blob = await res.blob();
        if (dir) {
          const file = await dir.getFileHandle(`${fileName}.pdf`, { create: true });
          const writable = await file.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${fileName}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      setMessage(
        failed.length > 0
          ? `Done, but couldn't export: ${failed.join(", ")}`
          : `Exported ${chosen.length} PDF${chosen.length === 1 ? "" : "s"}${dir ? " to the chosen folder" : " to your downloads"}.`,
      );
    } catch {
      setMessage("Export stopped because of an error. Please try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const all = (paths ?? []).map((p) => p.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Bulk export paths</h2>
          <p className="text-xs text-slate-500">Choose the paths to export, then pick a folder to save them in.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!paths && <p className="text-sm text-slate-400">Loading...</p>}
          {paths && paths.length === 0 && <p className="text-sm text-slate-500">No saved paths yet.</p>}
          {paths && paths.length > 0 && (
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={selected.size === all.length}
                onChange={(e) => toggle(all, e.target.checked)}
              />
              Select all ({all.length})
            </label>
          )}
          {byWorkflow.map(([workflowName, list]) => {
            const ids = list.map((p) => p.id);
            return (
              <div key={workflowName} className="mb-3">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <input
                    type="checkbox"
                    checked={ids.every((id) => selected.has(id))}
                    onChange={(e) => toggle(ids, e.target.checked)}
                  />
                  {workflowName}
                </label>
                <div className="mt-1 flex flex-col gap-1 pl-5">
                  {list.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={(e) => toggle([p.id], e.target.checked)} />
                      {p.name}
                      <span className="text-xs text-slate-400">{p.nodeIds.length} steps</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{progress || message}</p>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
              Close
            </button>
            <button
              onClick={exportSelected}
              disabled={busy || selected.size === 0}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? "Exporting..." : `Choose folder & export (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
