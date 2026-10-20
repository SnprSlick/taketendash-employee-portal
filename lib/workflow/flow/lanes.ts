import type { FlowEdge } from "./types";

// A branch out of a decision node: a group of one or more edges that share
// the same sourceHandle (a single logical choice, e.g. "Charge", that may
// fan out to several parallel target nodes at once).
export type DecisionBranch = {
  key: string;
  label: string;
  targets: string[];
};

export function edgeLabel(edge: FlowEdge): string {
  return (typeof edge.label === "string" ? edge.label : edge.data?.label) || "Continue";
}

// Builds the main-flow adjacency map (source -> outgoing edges), excluding
// wait-node signal edges — a signal edge is a side-channel unlock wire, not
// part of the sequential flow, so it must never be counted as one of its
// source node's normal outgoing branches (which would wrongly look like a
// fan-out/split there).
export function buildAdjacency(edges: FlowEdge[]) {
  const outgoing = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    if (isWaitSignalEdge(e)) return;
    const list = outgoing.get(e.source) ?? [];
    list.push(e);
    outgoing.set(e.source, list);
  });
  return outgoing;
}

// Groups a decision node's outgoing edges by branch (sourceHandle, falling
// back to label) so a branch that fans out to multiple targets is one choice
// with multiple parallel starting nodes, not several choices.
export function getDecisionBranches(outgoing: Map<string, FlowEdge[]>, decisionNodeId: string): DecisionBranch[] {
  const branchEdges = outgoing.get(decisionNodeId) ?? [];
  const groups = new Map<string, DecisionBranch>();
  branchEdges.forEach((edge) => {
    const key = edge.sourceHandle ?? edgeLabel(edge);
    const existing = groups.get(key);
    if (existing) {
      existing.targets.push(edge.target);
    } else {
      groups.set(key, { key, label: edgeLabel(edge), targets: [edge.target] });
    }
  });
  return [...groups.values()];
}

// A wait node's "signal-in" handle carries a separate edge from whatever
// node should unblock it — that edge is plumbing, not part of the main
// sequential flow, so every traversal (walkthrough, document propagation,
// PDF outline) must filter it out and only follow the node's normal
// (unlabeled target handle) outgoing/incoming edges.
export function isWaitSignalEdge(edge: FlowEdge): boolean {
  return edge.targetHandle === "signal-in";
}

// The node wired into a wait node's signal-in handle — reaching this node in
// the walkthrough is what unblocks the wait. Undefined if unwired.
export function getWaitSignalSource(edges: FlowEdge[], waitNodeId: string): string | undefined {
  return edges.find((e) => e.target === waitNodeId && isWaitSignalEdge(e))?.source;
}

// A wait node's single main-flow outgoing target (its normal bottom output),
// excluding any signal edges sourced from it (a wait node's own output is
// never used as someone else's signal source, but this stays defensive).
export function getWaitMainTarget(outgoing: Map<string, FlowEdge[]>, waitNodeId: string): string | undefined {
  return outgoing.get(waitNodeId)?.find((e) => !isWaitSignalEdge(e))?.target;
}

