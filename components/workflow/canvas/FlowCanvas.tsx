"use client";

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type OnConnectEnd,
  type OnConnectStart,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { StartNode } from "./StartNode";
import { StepNode } from "./StepNode";
import { DecisionNode } from "./DecisionNode";
import { EndNode } from "./EndNode";
import { SubworkflowNode } from "./SubworkflowNode";
import { WaitNode } from "./WaitNode";
import { DeletableEdge } from "./DeletableEdge";
import { LoopBackEdge } from "./LoopBackEdge";
import { NodeCreatePopover, type NewNodeType } from "./NodeCreatePopover";
import { SelectionBar } from "./SelectionBar";
import { ExtractSubworkflowModal } from "./ExtractSubworkflowModal";
import type { Bin, FlowEdge, FlowNode, Location, Role, RoleGroup, WorkflowDocument, WorkflowSummary } from "@/lib/workflow/flow/types";
import { assignedColor } from "@/lib/workflow/flow/assignedRoles";
import { planSubworkflowExtraction, isExtractionError } from "@/lib/workflow/flow/extractSubworkflow";
import { computeDocumentPresence } from "@/lib/workflow/flow/documents";
import { computeStepNumbers } from "@/lib/workflow/flow/numbering";

const nodeTypes = {
  start: StartNode,
  step: StepNode,
  decision: DecisionNode,
  end: EndNode,
  subworkflow: SubworkflowNode,
  wait: WaitNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
  loopback: LoopBackEdge,
};

// An edge "loops back" when its target sits at or above its source in the flow —
// i.e. it points back toward an earlier step rather than continuing forward.
function isLoopBackEdge(edge: { source: string; target: string }, nodes: FlowNode[]): boolean {
  const source = nodes.find((n) => n.id === edge.source);
  const target = nodes.find((n) => n.id === edge.target);
  if (!source || !target) return false;
  return target.position.y <= source.position.y;
}

function makeNodeData(type: NewNodeType, label: string) {
  if (type === "decision") return { label, branches: ["Yes", "No"] };
  if (type === "subworkflow") return { label, refWorkflowId: undefined };
  return { label };
}

const GRID_SIZE = 16;

function snapToGridPoint(point: { x: number; y: number }) {
  return {
    x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
  };
}

function FlowCanvasInner({
  initialNodes,
  initialEdges,
  roles,
  groups,
  bins,
  locations,
  documents,
  subworkflows,
  onOpenSubworkflow,
  onExtractSubworkflow,
  onExportSelection,
  pickMode,
  pickedIds,
  excludedEdgeIds,
  onPickToggle,
  onPickEdgeToggle,
  onChange,
  onManageRoles,
  onManageBins,
  onManageDocuments,
  onSelectedNodeIdChange,
  roleUpdateRequest,
  groupUpdateRequest,
  binUpdateRequest,
}: {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  roles: Role[];
  groups: RoleGroup[];
  bins: Bin[];
  locations: Location[];
  documents: WorkflowDocument[];
  subworkflows: WorkflowSummary[];
  onOpenSubworkflow: (workflowId: string) => void;
  onExtractSubworkflow: (name: string, nodes: FlowNode[], edges: FlowEdge[]) => Promise<string>;
  onExportSelection: (nodeIds: string[]) => void;
  pickMode: boolean;
  pickedIds: string[];
  excludedEdgeIds: string[];
  onPickToggle: (nodeId: string) => void;
  onPickEdgeToggle: (edgeId: string) => void;
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onManageRoles: () => void;
  onManageBins: () => void;
  onManageDocuments?: () => void;
  onSelectedNodeIdChange: (nodeId: string | null) => void;
  roleUpdateRequest: { requestId: number; nodeId: string; roleId: string | undefined } | null;
  groupUpdateRequest: { requestId: number; nodeId: string; groupId: string | undefined } | null;
  binUpdateRequest: { requestId: number; nodeId: string; binId: string | undefined } | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges ?? []);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{
    screenPosition: { x: number; y: number };
    flowPosition: { x: number; y: number };
    sourceNodeId: string | null;
    sourceHandleId: string | null;
  } | null>(null);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange(nodes, edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Copy / paste: Cmd/Ctrl+C remembers the selected nodes and the connections
  // between them; Cmd/Ctrl+V adds a fresh copy, offset a little each time.
  const clipboardRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[]; pastes: number } | null>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || pickMode) return;
      const key = event.key.toLowerCase();
      if (key !== "c" && key !== "v") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (key === "c") {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length === 0 || window.getSelection()?.toString()) return;
        const ids = new Set(selected.map((n) => n.id));
        clipboardRef.current = {
          nodes: selected.map((n) => structuredClone({ ...n, selected: false })),
          edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => structuredClone(e)),
          pastes: 0,
        };
        event.preventDefault();
        return;
      }

      const clip = clipboardRef.current;
      if (!clip) return;
      event.preventDefault();
      clip.pastes += 1;
      const offset = 40 * clip.pastes;
      const idMap = new Map(clip.nodes.map((n) => [n.id, nanoid(8)]));
      const copies = clip.nodes.map((n) => ({
        ...structuredClone(n),
        id: idMap.get(n.id)!,
        position: snapToGridPoint({ x: n.position.x + offset, y: n.position.y + offset }),
        selected: true,
      })) as FlowNode[];
      const edgeCopies = clip.edges.map((e) => ({
        ...structuredClone(e),
        id: nanoid(8),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      })) as FlowEdge[];
      setNodes((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), ...copies]);
      setEdges((eds) => [...eds, ...edgeCopies]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, edges, pickMode, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: "deletable" }, eds));
    },
    [setEdges],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges],
  );

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectStartRef.current = { nodeId: params.nodeId ?? "", handleId: params.handleId };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const start = connectStartRef.current;
      connectStartRef.current = null;
      if (!start) return;

      const target = event.target as HTMLElement;
      const isPane = target.classList.contains("react-flow__pane");
      if (!isPane) return;

      const clientX = "clientX" in event ? event.clientX : event.changedTouches[0].clientX;
      const clientY = "clientY" in event ? event.clientY : event.changedTouches[0].clientY;

      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });

      setPendingConnection({
        screenPosition: { x: clientX, y: clientY },
        flowPosition,
        sourceNodeId: start.nodeId,
        sourceHandleId: start.handleId,
      });
    },
    [screenToFlowPosition],
  );

  const handlePaneClick = useCallback(() => {
    setPendingConnection(null);
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const clientX = "clientX" in event ? event.clientX : 0;
      const clientY = "clientY" in event ? event.clientY : 0;
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });

      setPendingConnection({
        screenPosition: { x: clientX, y: clientY },
        flowPosition,
        sourceNodeId: null,
        sourceHandleId: null,
      });
    },
    [screenToFlowPosition],
  );

  const handleLabelChange = useCallback(
    (nodeId: string, label: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, label } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges],
  );

  const handleBranchesChange = useCallback(
    (nodeId: string, branches: string[]) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId && n.type === "decision" ? { ...n, data: { ...n.data, branches } } : n)),
      );
      setEdges((eds) =>
        eds.map((e) => {
          if (e.source !== nodeId || !e.sourceHandle?.startsWith("branch-")) return e;
          const idx = Number(e.sourceHandle.replace("branch-", ""));
          const newLabel = branches[idx];
          if (newLabel === undefined) return e;
          return { ...e, label: newLabel, data: { ...e.data, label: newLabel } };
        }),
      );
    },
    [setNodes, setEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: FlowNode[] }) => {
      onSelectedNodeIdChange(selected.length === 1 ? selected[0].id : null);
      setSelectedNodeIds(selected.map((n) => n.id));
    },
    [onSelectedNodeIdChange],
  );

  const handleRoleChange = useCallback(
    (nodeId: string, roleId: string | undefined) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, roleId } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const appliedRoleRequestId = useRef<number | null>(null);
  useEffect(() => {
    if (!roleUpdateRequest || appliedRoleRequestId.current === roleUpdateRequest.requestId) return;
    appliedRoleRequestId.current = roleUpdateRequest.requestId;
    handleRoleChange(roleUpdateRequest.nodeId, roleUpdateRequest.roleId);
  }, [roleUpdateRequest, handleRoleChange]);

  const handleGroupChange = useCallback(
    (nodeId: string, groupId: string | undefined) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, groupId } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const appliedGroupRequestId = useRef<number | null>(null);
  useEffect(() => {
    if (!groupUpdateRequest || appliedGroupRequestId.current === groupUpdateRequest.requestId) return;
    appliedGroupRequestId.current = groupUpdateRequest.requestId;
    handleGroupChange(groupUpdateRequest.nodeId, groupUpdateRequest.groupId);
  }, [groupUpdateRequest, handleGroupChange]);

  const handleBinChange = useCallback(
    (nodeId: string, binId: string | undefined) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, binId } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const appliedBinRequestId = useRef<number | null>(null);
  useEffect(() => {
    if (!binUpdateRequest || appliedBinRequestId.current === binUpdateRequest.requestId) return;
    appliedBinRequestId.current = binUpdateRequest.requestId;
    handleBinChange(binUpdateRequest.nodeId, binUpdateRequest.binId);
  }, [binUpdateRequest, handleBinChange]);

  const handleDocumentIdsChange = useCallback(
    (nodeId: string, documentIds: string[]) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, documentIds } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const handleDocumentRoutingChange = useCallback(
    (nodeId: string, documentRouting: Record<string, number[]>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId && n.type === "decision" ? { ...n, data: { ...n.data, documentRouting } } : n,
        ),
      );
    },
    [setNodes],
  );

  const documentPresence = computeDocumentPresence(nodes, edges, documents);
  const stepNumbers = computeStepNumbers(nodes, edges);

  const handleRefWorkflowChange = useCallback(
    (nodeId: string, refWorkflowId: string | undefined) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? ({ ...n, data: { ...n.data, refWorkflowId } } as FlowNode) : n)),
      );
    },
    [setNodes],
  );

  const [extractionError, setExtractionError] = useState<string | null>(null);

  const handleConfirmExtraction = useCallback(
    async (name: string) => {
      const selectedIds = new Set(selectedNodeIds);
      const plan = planSubworkflowExtraction(selectedIds, nodes, edges);
      if (isExtractionError(plan)) {
        setExtractionError(plan.detail);
        return;
      }

      const { internalNodes, internalEdges, incomingEdges, outgoingEdges } = plan;

      // Strip transient positions to something sane for the new canvas —
      // keep relative layout by normalizing to the selection's top-left corner.
      const minX = Math.min(...internalNodes.map((n) => n.position.x));
      const minY = Math.min(...internalNodes.map((n) => n.position.y));
      const newWorkflowNodes = internalNodes.map((n) => ({
        ...n,
        position: { x: n.position.x - minX + 80, y: n.position.y - minY + 80 },
      }));

      let newWorkflowId: string;
      try {
        newWorkflowId = await onExtractSubworkflow(name, newWorkflowNodes, internalEdges);
      } catch {
        setExtractionError("Failed to create the sub-workflow. Please try again.");
        return;
      }

      const subflowNodeId = nanoid(8);
      const avgX = internalNodes.reduce((sum, n) => sum + n.position.x, 0) / internalNodes.length;
      const avgY = internalNodes.reduce((sum, n) => sum + n.position.y, 0) / internalNodes.length;

      const subflowNode: FlowNode = {
        id: subflowNodeId,
        type: "subworkflow",
        position: snapToGridPoint({ x: avgX, y: avgY }),
        data: { label: name, refWorkflowId: newWorkflowId },
      };

      setNodes((nds) => [...nds.filter((n) => !selectedIds.has(n.id)), subflowNode]);
      setEdges((eds) => {
        const remaining = eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));
        // Every incoming edge shares the same outside source node (validated above);
        // retarget each to the new node, deduping in case several branches from
        // that source already pointed at different internal nodes.
        const rewiredIncoming = incomingEdges.map((e) => ({ ...e, target: subflowNodeId }));
        const rewiredOutgoing = outgoingEdges.map((e) => ({ ...e, source: subflowNodeId, sourceHandle: undefined }));
        const seen = new Set<string>();
        const deduped = [...rewiredIncoming, ...rewiredOutgoing].filter((e) => {
          const key = `${e.source}-${e.sourceHandle ?? ""}->${e.target}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...remaining, ...deduped];
      });

      setSelectedNodeIds([]);
      setExtractModalOpen(false);
    },
    [selectedNodeIds, nodes, edges, onExtractSubworkflow, setNodes, setEdges],
  );

  const pickedSet = new Set(pickedIds);
  const nodesWithActions = nodes.map((n) => ({
    ...n,
    className: pickMode && pickedSet.has(n.id) ? "picked" : undefined,
    data: {
      ...n.data,
      roles,
      groups,
      bins,
      locations,
      documents,
      onLabelChange: handleLabelChange,
      onDelete: handleDeleteNode,
      onRoleChange: handleRoleChange,
      onGroupChange: handleGroupChange,
      onManageRoles,
      onBinChange: handleBinChange,
      onManageBins,
      onDocumentIdsChange: handleDocumentIdsChange,
      onDocumentRoutingChange: handleDocumentRoutingChange,
      onManageDocuments,
      incomingDocumentIds: (documentPresence.get(n.id) ?? []).map((d) => d.id),
      stepNumber: stepNumbers.get(n.id),
      subworkflows,
      onOpenSubworkflow,
      onRefWorkflowChange: handleRefWorkflowChange,
      ...(n.type === "decision" ? { onBranchesChange: handleBranchesChange } : {}),
    },
  })) as FlowNode[];

  // While picking a path, connections between two picked nodes are on by
  // default (bold blue); click one to leave it out (faint dashed) or back in.
  const excludedEdgeSet = new Set(excludedEdgeIds);
  const edgesWithActions = edges.map((e) => {
    const connecting = pickMode && pickedSet.has(e.source) && pickedSet.has(e.target);
    const pickStyle = !pickMode
      ? undefined
      : !connecting
        ? { opacity: 0.35 }
        : excludedEdgeSet.has(e.id)
          ? { stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1.5, opacity: 0.6 }
          : { stroke: "#2563eb", strokeWidth: 3.5 };
    return {
      ...e,
      type: isLoopBackEdge(e, nodes) ? "loopback" : "deletable",
      style: pickStyle ? { ...e.style, ...pickStyle } : e.style,
      data: { ...e.data, onDelete: handleDeleteEdge, pickMode },
    };
  });

  const handleCreateNode = useCallback(
    (type: NewNodeType, label: string) => {
      if (!pendingConnection) return;
      const id = nanoid(8);
      const newNode: FlowNode = {
        id,
        type,
        position: snapToGridPoint(pendingConnection.flowPosition),
        data: makeNodeData(type, label) as never,
      };

      setNodes((nds) => [...nds, newNode]);

      if (pendingConnection.sourceNodeId) {
        let branchLabel: string | undefined;
        const sourceNode = nodes.find((n) => n.id === pendingConnection.sourceNodeId);
        if (sourceNode?.type === "decision" && pendingConnection.sourceHandleId) {
          const idx = Number(pendingConnection.sourceHandleId.replace("branch-", ""));
          branchLabel = sourceNode.data.branches?.[idx];
        }

        const newEdge: FlowEdge = {
          id: nanoid(8),
          source: pendingConnection.sourceNodeId,
          sourceHandle: pendingConnection.sourceHandleId ?? undefined,
          target: id,
          type: "deletable",
          label: branchLabel,
          data: { label: branchLabel },
        };
        setEdges((eds) => [...eds, newEdge]);
      }

      setPendingConnection(null);
    },
    [pendingConnection, nodes, setNodes, setEdges],
  );

  return (
    <div className="relative h-full w-full bg-white">
      <ReactFlow
        nodes={nodesWithActions}
        edges={edgesWithActions}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={handleSelectionChange}
        onEdgeClick={(_, edge) => {
          if (pickMode && pickedSet.has(edge.source) && pickedSet.has(edge.target)) onPickEdgeToggle(edge.id);
        }}
        onNodeClick={(_, node) => {
          if (pickMode) onPickToggle(node.id);
        }}
        nodesDraggable={!pickMode}
        nodesConnectable={!pickMode}
        elementsSelectable={!pickMode}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        deleteKeyCode={["Backspace", "Delete"]}
        snapToGrid
        snapGrid={[16, 16]}
        panOnDrag={[0, 1]}
        selectionOnDrag={false}
        selectionKeyCode={["Meta", "Control"]}
        multiSelectionKeyCode={["Meta", "Shift", "Control"]}
        fitView
      >
        <Background color="#cbd5e1" gap={16} />
        <Controls className="!shadow-sm" />
        <MiniMap
          className="!border !border-slate-200 !shadow-sm"
          pannable
          zoomable
          nodeColor={(node) =>
            assignedColor(node.data as { roleId?: string; groupId?: string }, roles, groups) ?? "#cbd5e1"
          }
          nodeStrokeWidth={0}
        />
      </ReactFlow>
      {pendingConnection && (
        <NodeCreatePopover
          screenPosition={pendingConnection.screenPosition}
          onCreate={handleCreateNode}
          onCancel={() => setPendingConnection(null)}
        />
      )}
      {!pickMode && selectedNodeIds.length >= 1 && !extractModalOpen && (
        <SelectionBar
          count={selectedNodeIds.length}
          onExportPdf={() => onExportSelection(selectedNodeIds)}
          onExtract={() => setExtractModalOpen(true)}
        />
      )}
      {extractModalOpen && (
        <ExtractSubworkflowModal
          nodeCount={selectedNodeIds.length}
          onConfirm={handleConfirmExtraction}
          onCancel={() => setExtractModalOpen(false)}
        />
      )}
      {extractionError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-sm font-semibold text-red-600">Can&apos;t extract sub-workflow</h2>
            <p className="mb-4 text-sm text-slate-600">{extractionError}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setExtractionError(null)}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  roles: Role[];
  groups: RoleGroup[];
  bins: Bin[];
  locations: Location[];
  documents: WorkflowDocument[];
  subworkflows: WorkflowSummary[];
  onOpenSubworkflow: (workflowId: string) => void;
  onExtractSubworkflow: (name: string, nodes: FlowNode[], edges: FlowEdge[]) => Promise<string>;
  onExportSelection: (nodeIds: string[]) => void;
  pickMode: boolean;
  pickedIds: string[];
  excludedEdgeIds: string[];
  onPickToggle: (nodeId: string) => void;
  onPickEdgeToggle: (edgeId: string) => void;
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onManageRoles: () => void;
  onManageBins: () => void;
  onManageDocuments?: () => void;
  onSelectedNodeIdChange: (nodeId: string | null) => void;
  roleUpdateRequest: { requestId: number; nodeId: string; roleId: string | undefined } | null;
  groupUpdateRequest: { requestId: number; nodeId: string; groupId: string | undefined } | null;
  binUpdateRequest: { requestId: number; nodeId: string; binId: string | undefined } | null;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
