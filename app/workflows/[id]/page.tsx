"use client";

import { wfFetch } from "@/lib/workflow/wfFetch";
import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { FlowCanvas } from "@/components/workflow/canvas/FlowCanvas";
import { ExportPdfModal } from "@/components/workflow/ExportPdfModal";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { NotesSidebar } from "@/components/workflow/NotesSidebar";
import { DocumentsSidebar } from "@/components/workflow/DocumentsSidebar";
import { RolesManagerModal } from "@/components/workflow/RolesManagerModal";
import { BinsManagerModal } from "@/components/workflow/BinsManagerModal";
import { PathPickBar } from "@/components/workflow/canvas/PathPickBar";
import type { WorkflowPathRecord } from "@/lib/workflow/flow/paths";
import { PropertiesPanel } from "@/components/workflow/PropertiesPanel";
import type {
  Bin,
  FlowEdge,
  FlowNode,
  Location,
  Role,
  RoleGroup,
  WorkflowDocument,
  WorkflowNote,
  WorkflowRecord,
  WorkflowSummary,
} from "@/lib/workflow/flow/types";

export default function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<WorkflowNote[]>([]);
  const [documents, setDocuments] = useState<WorkflowDocument[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subworkflows, setSubworkflows] = useState<WorkflowSummary[]>([]);
  const [fromWorkflowId, setFromWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    setFromWorkflowId(new URLSearchParams(window.location.search).get("from"));
  }, [id]);
  const [managingRoles, setManagingRoles] = useState(false);
  const [managingBins, setManagingBins] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [exporting, setExporting] = useState(false);
  const [currentNodes, setCurrentNodes] = useState<FlowNode[]>([]);
  const [currentEdges, setCurrentEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [roleUpdateRequest, setRoleUpdateRequest] = useState<{
    requestId: number;
    nodeId: string;
    roleId: string | undefined;
  } | null>(null);
  const [groupUpdateRequest, setGroupUpdateRequest] = useState<{
    requestId: number;
    nodeId: string;
    groupId: string | undefined;
  } | null>(null);
  const [binUpdateRequest, setBinUpdateRequest] = useState<{
    requestId: number;
    nodeId: string;
    binId: string | undefined;
  } | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleRequestCounter = useRef(0);
  const groupRequestCounter = useRef(0);
  const binRequestCounter = useRef(0);

  useEffect(() => {
    wfFetch(`/api/workflows/${id}`)
      .then((res) => res.json())
      .then((data: WorkflowRecord) => {
        setWorkflow(data);
        setName(data.name);
        setNotes(data.notes ?? []);
        setDocuments(data.documents ?? []);
        setCurrentNodes(data.nodes ?? []);
        setCurrentEdges(data.edges ?? []);
      });
    refreshRoles();
    refreshGroups();
    refreshBinsAndLocations();
    refreshSubworkflows();
  }, [id]);

  async function refreshRoles() {
    const res = await wfFetch("/api/roles");
    setRoles(await res.json());
  }

  async function refreshSubworkflows() {
    const res = await wfFetch("/api/workflows?templates=1");
    const all: WorkflowSummary[] = await res.json();
    setSubworkflows(all.filter((w) => w.id !== id));
  }

  async function handleExtractSubworkflow(name: string, nodes: FlowNode[], edges: FlowEdge[]): Promise<string> {
    const res = await wfFetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isTemplate: true, nodes, edges }),
    });
    if (!res.ok) throw new Error("Failed to create sub-workflow");
    const created: WorkflowSummary = await res.json();
    await refreshSubworkflows();
    return created.id;
  }

  async function refreshGroups() {
    const res = await wfFetch("/api/role-groups");
    setGroups(await res.json());
  }

  async function refreshBinsAndLocations() {
    const [locRes, binRes] = await Promise.all([wfFetch("/api/locations"), wfFetch("/api/bins")]);
    setLocations(await locRes.json());
    setBins(await binRes.json());
  }

  async function handleCreateRole(role: { title: string; description: string | null; color: string }) {
    await wfFetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(role),
    });
    refreshRoles();
  }

  async function handleUpdateRole(roleId: string, patch: { title?: string; description?: string | null; color?: string }) {
    await wfFetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refreshRoles();
  }

  async function handleDeleteRole(roleId: string) {
    await wfFetch(`/api/roles/${roleId}`, { method: "DELETE" });
    refreshRoles();
  }

  async function handleCreateGroup(group: { title: string; description: string | null; color: string; roleIds: string[] }) {
    await wfFetch("/api/role-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(group),
    });
    refreshGroups();
  }

  async function handleUpdateGroup(
    groupId: string,
    patch: { title?: string; description?: string | null; color?: string; roleIds?: string[] },
  ) {
    await wfFetch(`/api/role-groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refreshGroups();
  }

  async function handleDeleteGroup(groupId: string) {
    await wfFetch(`/api/role-groups/${groupId}`, { method: "DELETE" });
    refreshGroups();
  }

  async function handleCreateLocation(location: { letter: string; name: string }) {
    await wfFetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(location),
    });
    refreshBinsAndLocations();
  }

  async function handleUpdateLocation(locationId: string, patch: { letter?: string; name?: string }) {
    await wfFetch(`/api/locations/${locationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refreshBinsAndLocations();
  }

  async function handleDeleteLocation(locationId: string) {
    await wfFetch(`/api/locations/${locationId}`, { method: "DELETE" });
    refreshBinsAndLocations();
  }

  async function handleCreateBin(bin: { name: string; color: string; locationId: string }) {
    await wfFetch("/api/bins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bin),
    });
    refreshBinsAndLocations();
  }

  async function handleUpdateBin(binId: string, patch: { name?: string; color?: string; locationId?: string }) {
    await wfFetch(`/api/bins/${binId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refreshBinsAndLocations();
  }

  async function handleDeleteBin(binId: string) {
    await wfFetch(`/api/bins/${binId}`, { method: "DELETE" });
    refreshBinsAndLocations();
  }

  function scheduleSave(patch: Record<string, unknown>) {
    setSaveStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const res = await wfFetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Failed to save changes.");
        setSaveStatus("idle");
        return;
      }
      setSaveStatus("saved");
    }, 600);
  }

  function handleGraphChange(nodes: FlowNode[], edges: FlowEdge[]) {
    setCurrentNodes(nodes);
    setCurrentEdges(edges);
    scheduleSave({ nodes, edges });
  }

  function handlePanelRoleChange(nodeId: string, roleId: string | undefined) {
    roleRequestCounter.current += 1;
    setRoleUpdateRequest({ requestId: roleRequestCounter.current, nodeId, roleId });
  }

  function handlePanelGroupChange(nodeId: string, groupId: string | undefined) {
    groupRequestCounter.current += 1;
    setGroupUpdateRequest({ requestId: groupRequestCounter.current, nodeId, groupId });
  }

  function handlePanelBinChange(nodeId: string, binId: string | undefined) {
    binRequestCounter.current += 1;
    setBinUpdateRequest({ requestId: binRequestCounter.current, nodeId, binId });
  }

  function handleNameChange(newName: string) {
    setName(newName);
    scheduleSave({ name: newName });
  }

  function handleNotesChange(newNotes: WorkflowNote[]) {
    setNotes(newNotes);
    scheduleSave({ notes: newNotes });
  }

  function handleDocumentsChange(newDocuments: WorkflowDocument[]) {
    setDocuments(newDocuments);
    scheduleSave({ documents: newDocuments });
  }

  async function handleToggleTemplate(nextIsTemplate: boolean) {
    setWorkflow((w) => (w ? { ...w, isTemplate: nextIsTemplate } : w));
    await wfFetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTemplate: nextIsTemplate }),
    });
  }

  // The export dialog is open when this is set. `nodeIds` is the canvas
  // selection for a partial export; undefined exports the whole workflow.
  const [exportRequest, setExportRequest] = useState<{ nodeIds?: string[]; edgeIds?: string[]; name?: string } | null>(null);

  // Path picking: plain clicks toggle nodes; saved sets are "paths".
  const [pickMode, setPickMode] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  // Connections between picked nodes the user switched off.
  const [excludedEdgeIds, setExcludedEdgeIds] = useState<string[]>([]);
  const [paths, setPaths] = useState<WorkflowPathRecord[]>([]);
  const editingPath = paths.find((p) => p.id === editingPathId) ?? null;

  async function refreshPaths() {
    const res = await wfFetch(`/api/workflows/${id}/paths`);
    if (res.ok) setPaths(await res.json());
  }

  useEffect(() => {
    refreshPaths();
    setPickMode(false);
    setPickedIds([]);
    setEditingPathId(null);
  }, [id]);

  // Connections that count: both ends picked and not switched off.
  const pickedSet = new Set(pickedIds);
  const pickedEdgeIds = currentEdges
    .filter((e) => pickedSet.has(e.source) && pickedSet.has(e.target) && !excludedEdgeIds.includes(e.id))
    .map((e) => e.id);

  function togglePickEdge(edgeId: string) {
    setExcludedEdgeIds((ids) => (ids.includes(edgeId) ? ids.filter((i) => i !== edgeId) : [...ids, edgeId]));
  }

  function togglePick(nodeId: string) {
    setPickedIds((ids) => (ids.includes(nodeId) ? ids.filter((i) => i !== nodeId) : [...ids, nodeId]));
  }

  function endPicking() {
    setPickMode(false);
    setPickedIds([]);
    setExcludedEdgeIds([]);
    setEditingPathId(null);
  }

  function startPicking() {
    setSelectedNodeId(null);
    setPickMode(true);
  }

  async function savePath(name: string, asNew: boolean) {
    const url = asNew || !editingPathId ? `/api/workflows/${id}/paths` : `/api/workflows/${id}/paths/${editingPathId}`;
    const res = await wfFetch(url, {
      method: asNew || !editingPathId ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nodeIds: pickedIds, edgeIds: pickedEdgeIds }),
    });
    if (!res.ok) {
      alert("Failed to save path.");
      return;
    }
    const saved: WorkflowPathRecord = await res.json();
    await refreshPaths();
    setEditingPathId(saved.id);
  }

  async function deletePath(path: WorkflowPathRecord) {
    if (!confirm(`Delete path "${path.name}"?`)) return;
    await wfFetch(`/api/workflows/${id}/paths/${path.id}`, { method: "DELETE" });
    if (editingPathId === path.id) endPicking();
    await refreshPaths();
  }

  function editPath(path: WorkflowPathRecord) {
    const existing = new Set(currentNodes.map((n) => n.id));
    const nodeIds = path.nodeIds.filter((nid) => existing.has(nid));
    const inPath = new Set(nodeIds);
    setPickedIds(nodeIds);
    // A path saved with its connections: switch off the ones it left out.
    setExcludedEdgeIds(
      path.edgeIds
        ? currentEdges.filter((e) => inPath.has(e.source) && inPath.has(e.target) && !path.edgeIds!.includes(e.id)).map((e) => e.id)
        : [],
    );
    setEditingPathId(path.id);
    setSelectedNodeId(null);
    setPickMode(true);
  }

  function exportPath(path: WorkflowPathRecord) {
    const existing = new Set(currentNodes.map((n) => n.id));
    const nodeIds = path.nodeIds.filter((nid) => existing.has(nid));
    if (nodeIds.length === 0) {
      alert("None of this path's nodes exist in the workflow any more.");
      return;
    }
    setExportRequest({ nodeIds, edgeIds: path.edgeIds ?? undefined, name: path.name });
  }

  // Requests one PDF and saves it as `<fileName>.pdf`; returns false on failure.
  async function downloadPdf(fileName: string, nodeIds?: string[], title?: string, edgeIds?: string[]): Promise<boolean> {
    const res = await wfFetch(`/api/workflows/${id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeIds, edgeIds, fileName, title }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/[\\/:*?"<>|]/g, "").trim() || "workflow"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  async function handleExportPdf(fileName: string, nodeIds?: string[]) {
    setExporting(true);
    try {
      const ok = await downloadPdf(fileName, nodeIds, nodeIds ? exportRequest?.name ?? fileName : undefined, exportRequest?.edgeIds);
      if (!ok) throw new Error("Export failed");
      setExportRequest(null);
    } catch {
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  // One PDF per saved path, each named after its path.
  async function exportAllPaths() {
    const existing = new Set(currentNodes.map((n) => n.id));
    const used = new Map<string, number>();
    const failed: string[] = [];
    setExporting(true);
    try {
      for (const path of paths) {
        const nodeIds = path.nodeIds.filter((nid) => existing.has(nid));
        if (nodeIds.length === 0) {
          failed.push(path.name);
          continue;
        }
        const count = (used.get(path.name) ?? 0) + 1;
        used.set(path.name, count);
        const fileName = count > 1 ? `${path.name} (${count})` : path.name;
        if (!(await downloadPdf(fileName, nodeIds, path.name, path.edgeIds ?? undefined))) failed.push(path.name);
        await new Promise((r) => setTimeout(r, 300)); // let the browser start each download
      }
    } finally {
      setExporting(false);
    }
    if (failed.length > 0) alert(`Couldn't export: ${failed.join(", ")}`);
  }

  function handleExportJson() {
    if (!workflow) return;
    const assignableNodes = currentNodes.filter((n) => n.type !== "subworkflow");
    const usedGroupIds = new Set(assignableNodes.map((n) => n.data.groupId).filter(Boolean));
    const usedGroups = groups.filter((g) => usedGroupIds.has(g.id));
    const usedRoleIds = new Set([
      ...assignableNodes.map((n) => n.data.roleId).filter(Boolean),
      ...usedGroups.flatMap((g) => g.roles.map((r) => r.id)),
    ]);
    const usedBinIds = new Set(assignableNodes.map((n) => n.data.binId).filter(Boolean));
    const usedBins = bins.filter((b) => usedBinIds.has(b.id));
    const usedLocationIds = new Set(usedBins.map((b) => b.locationId));

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      workflow: {
        name,
        description: workflow.description,
        category: workflow.category,
        nodes: currentNodes,
        edges: workflow.edges,
        notes,
      },
      roles: roles.filter((r) => usedRoleIds.has(r.id)),
      groups: usedGroups,
      bins: usedBins,
      locations: locations.filter((l) => usedLocationIds.has(l.id)),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "workflow"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!workflow) {
    return <div className="p-8 text-sm text-slate-400">Loading...</div>;
  }

  const selectedNode = currentNodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {exportRequest && (
        <ExportPdfModal
          title={exportRequest.nodeIds ? (exportRequest.name ? `Export path "${exportRequest.name}"` : "Export selection to PDF") : "Export to PDF"}
          description={
            exportRequest.nodeIds
              ? `Only the ${exportRequest.nodeIds.length} selected ${exportRequest.nodeIds.length === 1 ? "node" : "nodes"} will be included. Step numbers match the full workflow.`
              : "The whole workflow will be exported."
          }
          defaultName={exportRequest.nodeIds ? exportRequest.name ?? `${name || "workflow"} - selection` : name || "workflow"}
          busy={exporting}
          onConfirm={(fileName) => handleExportPdf(fileName, exportRequest.nodeIds)}
          onCancel={() => setExportRequest(null)}
        />
      )}
      <WorkflowToolbar
        name={name}
        onNameChange={handleNameChange}
        saveStatus={saveStatus}
        onExportPdf={() => setExportRequest({})}
        onExportJson={handleExportJson}
        exporting={exporting}
        isTemplate={workflow.isTemplate}
        onToggleTemplate={handleToggleTemplate}
        fromWorkflowId={fromWorkflowId}
        workflowId={id}
        pickMode={pickMode}
        onTogglePick={() => (pickMode ? endPicking() : startPicking())}
        paths={paths}
        onExportPath={exportPath}
        onEditPath={editPath}
        onDeletePath={deletePath}
        onExportAllPaths={exportAllPaths}
      />
      <div className="flex flex-1 overflow-hidden">
        <NotesSidebar notes={notes} onNotesChange={handleNotesChange} />
        <DocumentsSidebar documents={documents} onDocumentsChange={handleDocumentsChange} />
        <div className={`relative flex-1 ${pickMode ? "pick-mode" : ""}`}>
          {pickMode && (
            <PathPickBar
              key={editingPathId ?? "new"}
              count={pickedIds.length}
              editingName={editingPath?.name ?? null}
              onClear={() => {
                setPickedIds([]);
                setExcludedEdgeIds([]);
              }}
              edgeCount={pickedEdgeIds.length}
              onExport={() => setExportRequest({ nodeIds: pickedIds, edgeIds: pickedEdgeIds, name: editingPath?.name })}
              onSave={(n) => savePath(n, false)}
              onSaveAsNew={(n) => savePath(n, true)}
              onDone={endPicking}
            />
          )}
          <FlowCanvas
            initialNodes={workflow.nodes ?? []}
            initialEdges={workflow.edges ?? []}
            roles={roles}
            groups={groups}
            bins={bins}
            locations={locations}
            documents={documents}
            subworkflows={subworkflows}
            onOpenSubworkflow={(workflowId) => router.push(`/workflows/${workflowId}?from=${id}`)}
            onExtractSubworkflow={handleExtractSubworkflow}
            onExportSelection={(nodeIds) => setExportRequest({ nodeIds })}
            pickMode={pickMode}
            pickedIds={pickedIds}
            excludedEdgeIds={excludedEdgeIds}
            onPickEdgeToggle={togglePickEdge}
            onPickToggle={togglePick}
            onChange={handleGraphChange}
            onManageRoles={() => setManagingRoles(true)}
            onManageBins={() => setManagingBins(true)}
            onSelectedNodeIdChange={setSelectedNodeId}
            roleUpdateRequest={roleUpdateRequest}
            groupUpdateRequest={groupUpdateRequest}
            binUpdateRequest={binUpdateRequest}
          />
        </div>
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            roles={roles}
            groups={groups}
            onRoleChange={(roleId) => handlePanelRoleChange(selectedNode.id, roleId)}
            onGroupChange={(groupId) => handlePanelGroupChange(selectedNode.id, groupId)}
            onManageRoles={() => setManagingRoles(true)}
            bins={bins}
            locations={locations}
            onBinChange={(binId) => handlePanelBinChange(selectedNode.id, binId)}
            onManageBins={() => setManagingBins(true)}
            subworkflows={subworkflows}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
      {managingRoles && (
        <RolesManagerModal
          roles={roles}
          onCreate={handleCreateRole}
          onUpdate={handleUpdateRole}
          onDelete={handleDeleteRole}
          groups={groups}
          onCreateGroup={handleCreateGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
          onClose={() => setManagingRoles(false)}
        />
      )}
      {managingBins && (
        <BinsManagerModal
          locations={locations}
          bins={bins}
          onCreateLocation={handleCreateLocation}
          onUpdateLocation={handleUpdateLocation}
          onDeleteLocation={handleDeleteLocation}
          onCreateBin={handleCreateBin}
          onUpdateBin={handleUpdateBin}
          onDeleteBin={handleDeleteBin}
          onClose={() => setManagingBins(false)}
        />
      )}
    </div>
  );
}
