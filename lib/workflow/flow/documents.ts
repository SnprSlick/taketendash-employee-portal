import type { DecisionNodeData, FlowEdge, FlowNode, WorkflowDocument } from "./types";

function nodeDocumentIds(node: FlowNode): string[] {
  return "documentIds" in node.data ? (node.data.documentIds ?? []) : [];
}

// A document is present at a node if it originates there, or if it was carried in from
// any predecessor and (for decision predecessors) the edge's branch is allowed for it.
export function computeDocumentPresence(
  nodes: FlowNode[],
  edges: FlowEdge[],
  documents: WorkflowDocument[],
): Map<string, WorkflowDocument[]> {
  const documentsById = new Map(documents.map((d) => [d.id, d]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, FlowEdge[]>();
  edges.forEach((e) => {
    const list = outgoing.get(e.source) ?? [];
    list.push(e);
    outgoing.set(e.source, list);
  });

  const present = new Map<string, Set<string>>();
  const starts = nodes.filter((n) => n.type === "start");
  if (starts.length === 0) return new Map();

  // Standard worklist/fixpoint traversal: a node is re-enqueued whenever its
  // incoming document set grows (e.g. two branches merge back into one node,
  // or two edges from the same decision branch fan out to different targets),
  // so documents keep propagating forward instead of stalling at the first visit.
  // Seed from every start node — a workflow can have more than one disconnected start.
  const queue = starts.map((s) => s.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const inherited = present.get(nodeId) ?? new Set<string>();
    nodeDocumentIds(node).forEach((id) => {
      if (documentsById.has(id)) inherited.add(id);
    });
    present.set(nodeId, inherited);

    const nodeEdges = outgoing.get(nodeId) ?? [];
    const routing = node.type === "decision" ? (node.data as DecisionNodeData).documentRouting : undefined;

    for (const edge of nodeEdges) {
      const branchIndex =
        node.type === "decision" && edge.sourceHandle?.startsWith("branch-")
          ? Number(edge.sourceHandle.replace("branch-", ""))
          : undefined;

      const carried = new Set<string>();
      inherited.forEach((docId) => {
        if (branchIndex === undefined) {
          carried.add(docId);
          return;
        }
        const allowedBranches = routing?.[docId];
        if (!allowedBranches || allowedBranches.includes(branchIndex)) {
          carried.add(docId);
        }
      });

      const existing = present.get(edge.target);
      const grew = carried.size > 0 && [...carried].some((id) => !existing?.has(id));
      if (existing) {
        carried.forEach((id) => existing.add(id));
      } else {
        present.set(edge.target, carried);
      }
      if (grew || !existing) {
        queue.push(edge.target);
      }
    }
  }

  const result = new Map<string, WorkflowDocument[]>();
  present.forEach((ids, nodeId) => {
    const docs = [...ids].map((id) => documentsById.get(id)).filter((d): d is WorkflowDocument => Boolean(d));
    result.set(nodeId, docs);
  });
  return result;
}
