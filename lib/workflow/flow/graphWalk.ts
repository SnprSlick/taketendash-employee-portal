import type { FlowEdge, FlowNode } from "./types";

export function findRootNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode | null {
  if (nodes.length === 0) return null;
  const targetIds = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targetIds.has(n.id));
  return root ?? nodes[0];
}

export function outgoingEdges(nodeId: string, edges: FlowEdge[]): FlowEdge[] {
  return edges.filter((e) => e.source === nodeId);
}

export function nodeById(nodeId: string, nodes: FlowNode[]): FlowNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}
