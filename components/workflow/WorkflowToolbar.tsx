"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkflowPathRecord } from "@/lib/workflow/flow/paths";

export function WorkflowToolbar({
  name,
  onNameChange,
  saveStatus,
  onExportPdf,
  onExportJson,
  exporting,
  isTemplate,
  onToggleTemplate,
  fromWorkflowId,
  workflowId,
  pickMode,
  onTogglePick,
  paths,
  onExportPath,
  onEditPath,
  onDeletePath,
  onExportAllPaths,
}: {
  name: string;
  onNameChange: (name: string) => void;
  saveStatus: "idle" | "saving" | "saved";
  onExportPdf: () => void;
  onExportJson: () => void;
  exporting: boolean;
  isTemplate: boolean;
  onToggleTemplate: (next: boolean) => void;
  fromWorkflowId?: string | null;
  workflowId: string;
  pickMode: boolean;
  onTogglePick: () => void;
  paths: WorkflowPathRecord[];
  onExportPath: (path: WorkflowPathRecord) => void;
  onEditPath: (path: WorkflowPathRecord) => void;
  onDeletePath: (path: WorkflowPathRecord) => void;
  onExportAllPaths: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathsOpen, setPathsOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(fromWorkflowId ? `/workflows/${fromWorkflowId}` : "/workflows")}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          &larr; {fromWorkflowId ? "Back" : "Workflows"}
        </button>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="rounded border border-transparent px-2 py-1 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-300 focus:outline-none"
        />
        <span className="text-xs text-slate-400">
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
        </span>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-500" title="Reusable workflows can be plugged into other workflows as a Sub-Workflow node">
          <input type="checkbox" checked={isTemplate} onChange={(e) => onToggleTemplate(e.target.checked)} />
          Reusable sub-workflow
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePick}
          className={`rounded border px-3 py-1.5 text-sm font-medium ${
            pickMode ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          title="Click nodes one by one to choose a path to export"
        >
          Pick path
        </button>
        <div className="relative">
          <button
            onClick={() => setPathsOpen((o) => !o)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Paths ({paths.length}) &#9662;
          </button>
          {pathsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPathsOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-80 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {paths.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">No saved paths yet. Use &ldquo;Pick path&rdquo; to build one.</p>
                )}
                {paths.length > 0 && (
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
                    <span className="text-[11px] text-slate-400">One PDF per path, named after it</span>
                    <button
                      onClick={() => {
                        setPathsOpen(false);
                        onExportAllPaths();
                      }}
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
                    >
                      Export all
                    </button>
                  </div>
                )}
                {paths.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.nodeIds.length} {p.nodeIds.length === 1 ? "node" : "nodes"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPathsOpen(false);
                        onExportPath(p);
                      }}
                      className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => {
                        setPathsOpen(false);
                        onEditPath(p);
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeletePath(p)}
                      className="px-1 text-xs text-red-500 hover:text-red-700"
                      title="Delete path"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => router.push(`/workflows/${workflowId}/walkthrough`)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Walkthrough
        </button>
      <div className="relative">
        <div className="flex overflow-hidden rounded">
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="rounded-l bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {exporting ? "Generating PDF..." : "Export to PDF"}
          </button>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={exporting}
            className="rounded-r border-l border-slate-700 bg-slate-800 px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            title="More export options"
          >
            &#9662;
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-20 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onExportJson();
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Save as JSON
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
