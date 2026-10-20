import type { FlowEdge, FlowNode } from "./types";

export type ExtractionPlan = {
  internalNodes: FlowNode[];
  internalEdges: FlowEdge[];
  // Every boundary edge from the single allowed outside source node — there
  // may be several (e.g. one per branch handle) but they all share one source.
  incomingEdges: FlowEdge[];
  // Every boundary edge to the single allowed outside target node — likewise
  // there may be several (e.g. two branches rejoining the same next step).
  outgoingEdges: FlowEdge[];
};

export type ExtractionError = {
  reason: "too-few-nodes" | "multiple-entry-points" | "multiple-exit-points";
  detail: string;
};

// Selected nodes can only become a Sub-Workflow if they form a single clean
// chain from the rest of the graph's point of view: at most one distinct
// unselected *node* feeding in, and at most one distinct unselected node being
// fed out to. Multiple edges converging on (or fanning from) the same outside
// node are fine — e.g. a decision's Yes/No branches, both fully inside the
// selection, that happen to rejoin the same downstream step — since the
// Sub-Workflow node's single input/output handle only needs one node on each
// side, not one edge. What it can't represent is routing to/from *different*
// outside nodes, which would silently collapse distinct destinations together.
export function planSubworkflowExtraction(
  selectedIds: Set<string>,
  nodes: FlowNode[],
  edges: FlowEdge[],
): ExtractionPlan | ExtractionError {
  if (selectedIds.size < 2) {
    return { reason: "too-few-nodes", detail: "Select at least two connected nodes to extract a sub-workflow." };
  }

  const internalNodes = nodes.filter((n) => selectedIds.has(n.id));
  const internalEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

  const incoming = edges.filter((e) => !selectedIds.has(e.source) && selectedIds.has(e.target));
  const outgoing = edges.filter((e) => selectedIds.has(e.source) && !selectedIds.has(e.target));

  const incomingSourceIds = new Set(incoming.map((e) => e.source));
  const outgoingTargetIds = new Set(outgoing.map((e) => e.target));

  if (incomingSourceIds.size > 1) {
    return {
      reason: "multiple-entry-points",
      detail: `The selection is reachable from ${incomingSourceIds.size} different nodes outside it. A sub-workflow can only have one entry point — narrow your selection or reconnect the extra edges first.`,
    };
  }
  if (outgoingTargetIds.size > 1) {
    return {
      reason: "multiple-exit-points",
      detail: `The selection leads to ${outgoingTargetIds.size} different nodes outside it. A sub-workflow can only have one exit point — narrow your selection or reconnect the extra edges first.`,
    };
  }

  return {
    internalNodes,
    internalEdges,
    incomingEdges: incoming,
    outgoingEdges: outgoing,
  };
}

export function isExtractionError(plan: ExtractionPlan | ExtractionError): plan is ExtractionError {
  return "reason" in plan;
}
