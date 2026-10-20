import type { FlowEdge, FlowNode } from "./types";
import { buildAdjacency, isWaitSignalEdge } from "./lanes";

// Outline-style numbers for nodes: "<start>.<step>.<branch>".
// - Each start (root) node begins a main number: 1.0.0, 2.0.0, ...
// - A node directly below another increments the step: 1.1.0, 1.2.0, ...
// - A split (a node with several outgoing edges) gives each child the same
//   step plus a branch number: 1.1.1, 1.1.2. Nested splits append another
//   branch segment (1.1.2.1). If all but one branch simply end, the survivor
//   stays on the main line (1.2.0) and the dead ends are numbered 1.1.1, 1.1.2.
// - Where branches merge, the node drops the last branch segment and takes the
//   step after the deepest incoming parent.
// Loop-back edges and wait-node signal edges don't affect numbering.
export type Path = number[]; // [start, step, ...branches]

function branchOrder(edge: FlowEdge): number {
  const m = edge.sourceHandle?.match(/^branch-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function formatStepNumber(path: Path): string {
  const parts = [...path];
  while (parts.length < 3) parts.push(0);
  return parts.join(".");
}

export type FlowAnalysis = {
  paths: Map<string, Path>;
  // Forward (non-loop-back) parents of each node; more than one means a merge.
  parents: Map<string, string[]>;
  // Forward (non-loop-back) child targets of each node, in numbering order.
  forwardTargets: Map<string, string[]>;
  // Ids of loop-back edges (edges that return to an earlier node).
  backEdgeIds: Set<string>;
};

export function analyzeFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowAnalysis {
  const outgoing = buildAdjacency(edges);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const xOf = (id: string) => nodesById.get(id)?.position.x ?? 0;

  const children = (id: string) =>
    (outgoing.get(id) ?? [])
      .filter((e) => nodesById.has(e.target))
      .sort((a, b) => branchOrder(a) - branchOrder(b) || xOf(a.target) - xOf(b.target));

  // Find back edges (loops) with a DFS so the remaining graph is a DAG.
  const allIncoming = new Set(edges.filter((e) => !isWaitSignalEdge(e)).map((e) => e.target));
  const roots = [
    ...nodes.filter((n) => n.type === "start"),
    ...nodes.filter((n) => n.type !== "start" && !allIncoming.has(n.id)),
  ];
  const state = new Map<string, 1 | 2>();
  const back = new Set<FlowEdge>();
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const e of children(id)) {
      const s = state.get(e.target);
      if (s === 1) back.add(e);
      else if (!s) dfs(e.target);
    }
    state.set(id, 2);
  };
  roots.forEach((r) => !state.has(r.id) && dfs(r.id));
  nodes.forEach((n) => !state.has(n.id) && dfs(n.id));

  const forwardKids = (id: string) => children(id).filter((e) => !back.has(e));
  const parents = new Map<string, string[]>();
  nodes.forEach((n) => forwardKids(n.id).forEach((e) => {
    const list = parents.get(e.target) ?? [];
    if (!list.includes(n.id)) parents.set(e.target, [...list, n.id]);
  }));

  const paths = new Map<string, Path>();
  const queue: string[] = [];
  roots.forEach((r, i) => {
    paths.set(r.id, [i + 1, 0]);
    queue.push(r.id);
  });

  const placed = new Set(roots.map((r) => r.id));
  const place = (target: string, candidate: Path) => {
    paths.set(target, candidate);
    placed.add(target);
    queue.push(target);
  };
  // Merge node: drop the last branch segment, step after the deepest parent.
  const placeMerge = (target: string) => {
    const parentPaths = (parents.get(target) ?? []).map((p) => paths.get(p)).filter((p): p is Path => Boolean(p));
    const shallowest = parentPaths.reduce((a, b) => (b.length < a.length ? b : a));
    const maxStep = Math.max(...parentPaths.map((p) => p[1]));
    const base = shallowest.length > 2 ? shallowest.slice(0, -1) : shallowest;
    place(target, [base[0], maxStep + 1, ...base.slice(2)]);
  };

  const propagate = () => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const path = paths.get(id)!;
      const targets = [...new Set(forwardKids(id).map((e) => e.target))];
      // A split where only one branch carries on (the rest just end) doesn't
      // open a new branch level: the survivor stays on the main line and the
      // dead ends take the branch numbers.
      const isDeadEnd = (t: string) => forwardKids(t).length === 0;
      const carryingOn = targets.filter((t) => !isDeadEnd(t));
      const soleSurvivor = targets.length > 1 && carryingOn.length === 1;
      let deadEndCount = 0;
      targets.forEach((target, i) => {
        const deadEndNumber = soleSurvivor && isDeadEnd(target) ? ++deadEndCount : 0;
        if (placed.has(target)) return;
        const ps = parents.get(target) ?? [];
        if (ps.length <= 1) {
          const nextStep: Path = [path[0], path[1] + 1, ...path.slice(2)];
          place(
            target,
            targets.length === 1 || (soleSurvivor && !deadEndNumber)
              ? nextStep
              : [...path, deadEndNumber || i + 1],
          );
        } else if (ps.every((p) => paths.has(p))) {
          placeMerge(target);
        }
      });
    }
  };
  propagate();

  // Fallback: a merge whose other parents are never numbered (e.g. they hang
  // off an unreachable branch) is numbered from the parents that are.
  for (let progress = true; progress; ) {
    progress = false;
    for (const n of nodes) {
      if (placed.has(n.id) || !(parents.get(n.id) ?? []).some((p) => paths.has(p))) continue;
      placeMerge(n.id);
      propagate();
      progress = true;
      break;
    }
  }

  const forwardTargets = new Map<string, string[]>();
  nodes.forEach((n) => forwardTargets.set(n.id, [...new Set(forwardKids(n.id).map((e) => e.target))]));
  return { paths, parents, forwardTargets, backEdgeIds: new Set([...back].map((e) => e.id)) };
}

// Orders two paths for "which is further along" comparisons.
export function comparePaths(a: Path | undefined, b: Path | undefined): number {
  const pa = a ?? [];
  const pb = b ?? [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function computeStepNumbers(nodes: FlowNode[], edges: FlowEdge[]): Map<string, string> {
  const result = new Map<string, string>();
  analyzeFlow(nodes, edges).paths.forEach((p, id) => result.set(id, formatStepNumber(p)));
  return result;
}
