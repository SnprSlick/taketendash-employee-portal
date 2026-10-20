"use client";

import { ReactFlow, ReactFlowProvider, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StartNode } from "./StartNode";
import { StepNode } from "./StepNode";
import { DecisionNode } from "./DecisionNode";
import { EndNode } from "./EndNode";
import { SubworkflowNode } from "./SubworkflowNode";
import { DeletableEdge } from "./DeletableEdge";
import { LoopBackEdge } from "./LoopBackEdge";
import type { Bin, FlowEdge, FlowNode, Location, Role, WorkflowSummary } from "@/lib/workflow/flow/types";

const nodeTypes = {
  start: StartNode,
  step: StepNode,
  decision: DecisionNode,
  end: EndNode,
  subworkflow: SubworkflowNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
  loopback: LoopBackEdge,
};

function isLoopBackEdge(edge: { source: string; target: string }, nodes: FlowNode[]): boolean {
  const source = nodes.find((n) => n.id === edge.source);
  const target = nodes.find((n) => n.id === edge.target);
  if (!source || !target) return false;
  return target.position.y <= source.position.y;
}

export function PrintCanvas({
  nodes,
  edges,
  roles,
  bins,
  locations,
  subworkflows = [],
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  roles: Role[];
  bins: Bin[];
  locations: Location[];
  subworkflows?: WorkflowSummary[];
}) {
  const printEdges = edges.map((e) => ({ ...e, type: isLoopBackEdge(e, nodes) ? "loopback" : "deletable" }));
  const printNodes = nodes.map((n) => ({ ...n, data: { ...n.data, roles, bins, locations, subworkflows } })) as FlowNode[];
  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={printNodes}
        edges={printEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
      >
        <Background />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
