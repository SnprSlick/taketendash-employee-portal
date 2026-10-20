"use client";

import { wfFetch } from "@/lib/workflow/wfFetch";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bin, FlowEdge, FlowNode, Location, Role, RoleGroup, WorkflowDocument, WorkflowRecord } from "@/lib/workflow/flow/types";
import { computeDocumentPresence } from "@/lib/workflow/flow/documents";
import { assignedColor } from "@/lib/workflow/flow/assignedRoles";
import { analyzeFlow, comparePaths, formatStepNumber } from "@/lib/workflow/flow/numbering";
import { buildAdjacency, getDecisionBranches, getWaitMainTarget, getWaitSignalSource, isWaitSignalEdge } from "@/lib/workflow/flow/lanes";
import type { WorkflowPathRecord } from "@/lib/workflow/flow/paths";

// Limits the graph to a saved path: its nodes and the connections it kept
// (all connections between its nodes when it didn't narrow them).
function scopeToPath(full: WorkflowRecord, path: WorkflowPathRecord | null): WorkflowRecord {
  if (!path) return full;
  const ids = new Set(path.nodeIds);
  const keep = path.edgeIds ? new Set(path.edgeIds) : null;
  return {
    ...full,
    nodes: full.nodes.filter((n) => ids.has(n.id)),
    edges: full.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && (!keep || keep.has(e.id))),
  };
}

// Where a walkthrough begins: the start nodes, or for a path the selected
// steps nothing else in the path leads into.
function findStarts(view: WorkflowRecord, path: WorkflowPathRecord | null): FlowNode[] {
  if (!path) return view.nodes.filter((n) => n.type === "start");
  const { backEdgeIds, paths } = analyzeFlow(view.nodes, view.edges);
  const hasInput = new Set(
    view.edges.filter((e) => !isWaitSignalEdge(e) && !backEdgeIds.has(e.id)).map((e) => e.target),
  );
  const roots = view.nodes.filter((n) => !hasInput.has(n.id));
  const pool = roots.length > 0 ? roots : view.nodes.slice(0, 1);
  return [...pool].sort((a, b) => comparePaths(paths.get(a.id), paths.get(b.id)));
}

// The walkthrough follows each document's path through the workflow. Most
// steps are a single shared node. When a node's outgoing edges fan out to
// more than one target (the node itself splits into parallel concurrent
// work — e.g. the Master Work Order and the Work Order Receipt going
// separate ways), the step becomes a "split": one independent track per
// target, labeled by whichever document(s) travel that path. A track can
// itself hit further decisions or splits, exactly like the top level.
//
// Coordinating two branches (e.g. pausing one until another catches up) is
// done with an explicit "wait" node placed in the workflow graph, not by any
// remerge logic here. A wait node has a normal top-in/bottom-out main flow,
// plus a separate "signal-in" edge wired from whatever node should unblock
// it. The walkthrough tracks every node any track has ever reached; when a
// track's next step would be a wait node, it checks whether that wait
// node's signal source has been reached anywhere yet — if so it passes
// straight through (the wait node itself is never shown as a step), and if
// not the track stops at its current step and waits.
//
// Numbering (see lib/flow/numbering.ts) drives two more rules:
//  - Only splits at the top level of the walkthrough (the 1.x.y branches) open
//    side-by-side columns. A fan-out inside a column does not split again: its
//    paths are queued and stacked one after another in that same column.
//  - A node with several incoming branches (a merge) waits until every branch
//    that can still reach it has arrived, then continues from the branch with
//    the higher step number (the number the merge node inherits).
type NodeStep = {
  kind: "node";
  nodeId: string;
  branch?: string;
  // Sibling targets of a fan-out inside a column, visited after this chain ends.
  queue?: string[];
  // A merge node not yet entered: some other branch hasn't reached it.
  waiting?: boolean;
  // A merge node that continued in another branch instead of this one.
  joined?: boolean;
  // Set when this step was pulled from a queue, so "Previous" can restore it.
  restore?: { index: number; queue: string[] };
};
type SplitStep = { kind: "split"; tracks: Track[] };
type Step = NodeStep | SplitStep;
type Track = { id: string; label?: string; status: "active" | "done"; steps: Step[] };

function nodeTypeLabel(node: { type?: string }) {
  switch (node.type) {
    case "start":
      return "Start";
    case "step":
      return "Step";
    case "decision":
      return "Decision";
    case "end":
      return "End";
    case "subworkflow":
      return "Sub-Workflow";
    case "wait":
      return "Wait";
    default:
      return node.type;
  }
}

// A path locates a position within the nested steps: [] is the top-level
// steps array; [stepIndex, trackIndex] descends into a split's track.
type Path = number[];

// Immutably replaces the steps array at `path` using `updater`, cloning only
// the nodes along the path.
function updateStepsAt(root: Step[], path: Path, updater: (steps: Step[]) => Step[]): Step[] {
  if (path.length === 0) return updater(root);
  const [stepIndex, trackIndex, ...rest] = path;
  return root.map((step, i) => {
    if (i !== stepIndex || step.kind !== "split") return step;
    return {
      ...step,
      tracks: step.tracks.map((track, ti) => {
        if (ti !== trackIndex) return track;
        return { ...track, steps: updateStepsAt(track.steps, rest, updater) };
      }),
    };
  });
}

// Collects every node id any track (at any depth) has ever reached — this is
// what a wait node's signal source is checked against.
function collectReachedNodes(steps: Step[], into: Set<string>) {
  for (const step of steps) {
    if (step.kind === "node") {
      into.add(step.nodeId);
    } else {
      for (const track of step.tracks) collectReachedNodes(track.steps, into);
    }
  }
}

export default function WorkflowWalkthroughPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [fullWorkflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [savedPaths, setSavedPaths] = useState<WorkflowPathRecord[] | null>(null);
  // undefined = still choosing; null = the whole workflow; otherwise a saved path.
  const [chosenPathId, setChosenPathId] = useState<string | null | undefined>(undefined);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rootSteps, setRootSteps] = useState<Step[]>([]);
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const activeStepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    wfFetch(`/api/workflows/${id}`)
      .then((res) => res.json())
      .then((data: WorkflowRecord) => setWorkflow(data));
    wfFetch(`/api/workflows/${id}/paths`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: WorkflowPathRecord[]) => setSavedPaths(list))
      .catch(() => setSavedPaths([]));
    wfFetch("/api/roles")
      .then((res) => res.json())
      .then(setRoles);
    wfFetch("/api/role-groups")
      .then((res) => res.json())
      .then(setGroups);
    wfFetch("/api/bins")
      .then((res) => res.json())
      .then(setBins);
    wfFetch("/api/locations")
      .then((res) => res.json())
      .then(setLocations);
  }, [id]);

  useEffect(() => {
    activeStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [rootSteps]);

  const chosenPath = useMemo(
    () => (chosenPathId ? (savedPaths ?? []).find((p) => p.id === chosenPathId) ?? null : null),
    [chosenPathId, savedPaths],
  );
  const workflow = useMemo(
    () => (fullWorkflow ? scopeToPath(fullWorkflow, chosenPath) : null),
    [fullWorkflow, chosenPath],
  );

  function choosePath(pathId: string | null) {
    if (!fullWorkflow) return;
    const path = pathId ? (savedPaths ?? []).find((p) => p.id === pathId) ?? null : null;
    const first = findStarts(scopeToPath(fullWorkflow, path), path);
    setChosenPathId(pathId);
    if (first.length === 1) {
      setStartNodeId(first[0].id);
      setRootSteps([{ kind: "node", nodeId: first[0].id }]);
    } else {
      setStartNodeId(null);
      setRootSteps([]);
    }
  }

  // No saved paths: go straight to the whole workflow.
  useEffect(() => {
    if (fullWorkflow && savedPaths && savedPaths.length === 0 && chosenPathId === undefined) choosePath(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWorkflow, savedPaths, chosenPathId]);

  const nodesById = useMemo(() => {
    const map = new Map<string, FlowNode>();
    workflow?.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [workflow]);

  const outgoingEdges = useMemo(() => {
    if (!workflow) return new Map<string, FlowEdge[]>();
    return buildAdjacency(workflow.edges);
  }, [workflow]);

  const analysis = useMemo(() => {
    if (!workflow) return analyzeFlow([], []);
    // Branching comes from the chosen path; the numbers stay the whole workflow's.
    const scoped = analyzeFlow(workflow.nodes, workflow.edges);
    if (!fullWorkflow || workflow === fullWorkflow) return scoped;
    return { ...scoped, paths: analyzeFlow(fullWorkflow.nodes, fullWorkflow.edges).paths };
  }, [workflow, fullWorkflow]);

  const roleTitle = (roleId?: string) => roles.find((r) => r.id === roleId)?.title;
  const roleColor = (roleId?: string) => roles.find((r) => r.id === roleId)?.color;

  const documentPresence = useMemo(() => {
    if (!workflow) return new Map<string, WorkflowDocument[]>();
    return computeDocumentPresence(workflow.nodes, workflow.edges, workflow.documents ?? []);
  }, [workflow]);

  if (!workflow || !fullWorkflow || !savedPaths) {
    return <div className="p-8 text-sm text-slate-400">Loading...</div>;
  }

  if (chosenPathId === undefined) {
    return (
      <div className="flex h-full flex-col bg-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <button
            onClick={() => router.push(`/workflows/${id}`)}
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            &larr; Back to editor
          </button>
          <div className="text-sm font-semibold text-slate-700">{fullWorkflow.name}</div>
          <div className="w-16" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Walkthrough</p>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Choose a path</h2>
            <div className="flex flex-col gap-2">
              {savedPaths.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choosePath(p.id)}
                  className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                >
                  {p.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">{p.nodeIds.length} steps</span>
                </button>
              ))}
              <button
                onClick={() => choosePath(null)}
                className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50"
              >
                Whole workflow
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const starts = findStarts(workflow, chosenPath);

  if (starts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 p-8 text-center">
        <p className="text-sm text-slate-500">This workflow has no start node to walk through.</p>
        <button
          onClick={() => router.push(`/workflows/${id}`)}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Back to editor
        </button>
      </div>
    );
  }

  if (starts.length > 1 && !startNodeId) {
    return (
      <div className="flex h-full flex-col bg-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <button
            onClick={() => router.push(`/workflows/${id}`)}
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            &larr; Back to editor
          </button>
          <div className="text-sm font-semibold text-slate-700">{workflow.name}</div>
          <div className="w-16" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              {chosenPath ? "This path has multiple starting points" : "This workflow has multiple starting points"}
            </p>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Choose where to begin</h2>
            <div className="flex flex-col gap-2">
              {starts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStartNodeId(s.id);
                    setRootSteps([{ kind: "node", nodeId: s.id }]);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                >
                  {s.data.label || "Untitled start"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rootSteps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-100 p-8 text-center">
        <p className="text-sm text-slate-500">This workflow has no start node to walk through.</p>
        <button
          onClick={() => router.push(`/workflows/${id}`)}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Back to editor
        </button>
      </div>
    );
  }

  const numberOf = (nodeId: string) => {
    const path = analysis.paths.get(nodeId);
    return path ? formatStepNumber(path) : undefined;
  };

  // Labels a top-level branch by its step number plus whichever document(s)
  // are present at its target node, falling back to "Path N".
  function trackLabel(targetNodeId: string, index: number): string | undefined {
    const docs = documentPresence.get(targetNodeId) ?? [];
    const parts = [numberOf(targetNodeId), docs.map((d) => d.name).join(" + ")].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : `Path ${index + 1}`;
  }

  // Resolves a single raw graph target into the node id a step should
  // actually land on, given the current set of reached nodes: if it's a
  // wait node, either passes straight through (signal already satisfied —
  // the wait node itself is never shown) or reports that this path should
  // stop here and wait.
  function resolveTarget(targetId: string, reached: Set<string>): { nodeId: string } | { waitNodeId: string } {
    const node = nodesById.get(targetId);
    if (node?.type !== "wait") return { nodeId: targetId };

    const signalSource = getWaitSignalSource(workflow!.edges, targetId);
    if (signalSource && reached.has(signalSource)) {
      const mainTarget = getWaitMainTarget(outgoingEdges, targetId);
      return mainTarget ? resolveTarget(mainTarget, reached) : { nodeId: targetId };
    }
    return { waitNodeId: targetId };
  }

  // Every node any open path could still walk into: the last real step of each
  // unfinished track plus everything queued behind a fan-out. `exclude` is the
  // step currently being advanced (it is moving on, so its other branches no
  // longer count).
  function collectFrontier(steps: Step[], into: Set<string>, exclude?: Step) {
    steps.forEach((step) => {
      if (step.kind === "node") step.queue?.forEach((q) => into.add(q));
    });
    const last = steps[steps.length - 1];
    if (last?.kind === "node" && last !== exclude && !last.waiting && !last.joined) into.add(last.nodeId);
    if (last?.kind === "split") last.tracks.forEach((t) => collectFrontier(t.steps, into, exclude));
  }

  function reachableFrom(frontier: Set<string>): Set<string> {
    const seen = new Set<string>();
    const stack = [...frontier];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      (analysis.forwardTargets.get(id) ?? []).forEach((t) => stack.push(t));
    }
    return seen;
  }

  // A merge node (2+ incoming branches) is blocked while any of its parents is
  // unreached yet still reachable by some open path. A parent on a choice that
  // was not taken can no longer be reached, so it never blocks.
  function mergeBlocked(nodeId: string, reached: Set<string>, frontier: Set<string>): boolean {
    const parents = analysis.parents.get(nodeId) ?? [];
    if (parents.length < 2) return false;
    // A parked wait node only counts as open if its signal can still fire
    // (already reached, or reachable by another open path); otherwise it is
    // stuck and must not hold up the merge.
    const active = new Set([...frontier].filter((id) => nodesById.get(id)?.type !== "wait"));
    const baseReach = reachableFrom(active);
    frontier.forEach((id) => {
      if (nodesById.get(id)?.type !== "wait") return;
      const signal = getWaitSignalSource(workflow!.edges, id);
      if (!signal || reached.has(signal) || baseReach.has(signal)) active.add(id);
    });
    const reachable = reachableFrom(active);
    return parents.some((p) => !reached.has(p) && reachable.has(p));
  }

  // `elsewhere` holds nodes already entered by other columns: a merge node one
  // of them already continued through is not entered again, it is marked joined.
  function makeNodeStep(
    targetId: string,
    reached: Set<string>,
    frontier: Set<string>,
    extra?: Partial<NodeStep>,
    elsewhere?: Set<string>,
  ): NodeStep {
    const resolved = resolveTarget(targetId, reached);
    if ("waitNodeId" in resolved) return { kind: "node", nodeId: resolved.waitNodeId, ...extra };
    if (elsewhere?.has(resolved.nodeId) && (analysis.parents.get(resolved.nodeId) ?? []).length > 1) {
      return { kind: "node", nodeId: resolved.nodeId, joined: true, ...extra };
    }
    if (mergeBlocked(resolved.nodeId, reached, frontier)) {
      return { kind: "node", nodeId: resolved.nodeId, waiting: true, ...extra };
    }
    return { kind: "node", nodeId: resolved.nodeId, ...extra };
  }

  // Builds the step(s) that follow from a set of edge targets. One target is a
  // single node step. Several targets split into side-by-side tracks only at
  // the top level; inside a track (`nested`) the first target is shown and the
  // rest are queued behind it in the same column.
  function buildFollowingSteps(
    targets: string[],
    reached: Set<string>,
    frontier: Set<string>,
    branch?: string,
    nested = false,
    elsewhere?: Set<string>,
  ): Step[] {
    if (targets.length === 0) return [];
    const sorted = [...targets].sort((a, b) => comparePaths(analysis.paths.get(a), analysis.paths.get(b)));
    if (sorted.length === 1) return [makeNodeStep(sorted[0], reached, frontier, { branch }, elsewhere)];
    if (nested) {
      const [first, ...rest] = sorted;
      return [makeNodeStep(first, reached, frontier, { branch, queue: rest }, elsewhere)];
    }
    const tracks: Track[] = sorted.map((t, i) => ({
      id: `${t}-${i}`,
      label: trackLabel(t, i),
      status: "active",
      steps: [makeNodeStep(t, reached, frontier)],
    }));
    return [{ kind: "split", tracks }];
  }

  // Appends what comes after the end of `steps`. If that is nothing (a dead
  // end) or a merge still waiting on another branch, pulls the next queued
  // sibling into this column instead; a blocked target is kept in the queue so
  // it is retried once the queue has been worked through.
  function extendSteps(
    steps: Step[],
    reached: Set<string>,
    frontier: Set<string>,
    targets: string[],
    branch: string | undefined,
    nested: boolean,
    elsewhere?: Set<string>,
  ): Step[] {
    const built = buildFollowingSteps(targets, reached, frontier, branch, nested, elsewhere);
    const only = built.length === 1 ? built[0] : undefined;
    const stuck = built.length === 0 || (only?.kind === "node" && only.waiting);
    if (!stuck) return [...steps, ...built];

    let holderIndex = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
      const st = steps[i];
      if (st.kind === "node" && st.queue?.some((q) => !reached.has(q))) {
        holderIndex = i;
        break;
      }
    }
    if (holderIndex < 0) return [...steps, ...built];

    const holder = steps[holderIndex] as NodeStep;
    const pending = holder.queue!.filter((q) => !reached.has(q));
    const [next, ...rest] = pending;
    const deferred = only?.kind === "node" ? [only.nodeId] : [];
    const out = [...steps];
    out[holderIndex] = { ...holder, queue: [...rest, ...deferred] };
    return [...out, makeNodeStep(next, reached, frontier, { restore: { index: holderIndex, queue: holder.queue! } }, elsewhere)];
  }

  // Recursively re-resolves any track currently sitting at an unresolved
  // wait node: if that wait node's signal source is now in `reached` (e.g.
  // because a sibling track just advanced past it), passes the track
  // through past the wait node onto its real next step(s). Runs after every
  // state change so a track that was waiting unblocks the moment another
  // track reaches its signal source, without requiring a click on the
  // waiting track itself.
  function releaseWaitingTracks(steps: Step[], reached: Set<string>): Step[] {
    return steps.map((step): Step => {
      if (step.kind === "node") return step;
      return {
        ...step,
        tracks: step.tracks.map((track) => {
          const releasedSteps = releaseWaitingTracks(track.steps, reached);
          const last = releasedSteps[releasedSteps.length - 1];
          if (last?.kind !== "node") return { ...track, steps: releasedSteps };
          const lastNode = nodesById.get(last.nodeId);
          if (lastNode?.type !== "wait") return { ...track, steps: releasedSteps };

          const signalSource = getWaitSignalSource(workflow!.edges, last.nodeId);
          if (!signalSource || !reached.has(signalSource)) return { ...track, steps: releasedSteps };

          const mainTarget = getWaitMainTarget(outgoingEdges, last.nodeId);
          if (!mainTarget) return { ...track, steps: releasedSteps };
          const withoutWait = releasedSteps.slice(0, -1);
          const nextReached = new Set(reached);
          collectReachedNodes(withoutWait, nextReached);
          const following = buildFollowingSteps([mainTarget], nextReached, new Set(), undefined, true);
          // A newly appended step may itself be a track that immediately
          // resolves further (a wait chained right after another wait), so
          // recurse once more over what was just added.
          return { ...track, steps: releaseWaitingTracks([...withoutWait, ...following], reached) };
        }),
      };
    });
  }

  // Releases merge nodes at the top level. A track parked on a merge marker is
  // ready once no other open path can still reach the merge node's parents.
  // If every track in the split is ready, joined, or finished, the split
  // collapses and the merge node continues full-width beneath it; otherwise it
  // continues in the track whose branch has the higher step number, and the
  // other waiting tracks are marked joined. Returns `root` itself if unchanged.
  function releaseMerges(root: Step[]): Step[] {
    const reached = new Set<string>();
    collectReachedNodes(root, reached);
    const frontier = new Set<string>();
    collectFrontier(root, frontier);

    const last = root[root.length - 1];
    if (last?.kind === "node") {
      if (last.waiting && !mergeBlocked(last.nodeId, reached, frontier)) {
        return [...root.slice(0, -1), { ...last, waiting: false }];
      }
      return root;
    }
    if (last?.kind !== "split") return root;

    const lastOf = (t: Track) => t.steps[t.steps.length - 1];
    const ready = new Map<string, number[]>();
    last.tracks.forEach((t, i) => {
      const l = lastOf(t);
      if (l?.kind === "node" && l.waiting && !mergeBlocked(l.nodeId, reached, frontier)) {
        ready.set(l.nodeId, [...(ready.get(l.nodeId) ?? []), i]);
      }
    });
    if (ready.size === 0) return root;

    const [mergeId, idxs] = [...ready.entries()][0];
    const parents = analysis.parents.get(mergeId) ?? [];
    const bestParentPath = (t: Track) =>
      t.steps.reduce<number[] | undefined>((best, st) => {
        if (st.kind !== "node" || !parents.includes(st.nodeId)) return best;
        const p = analysis.paths.get(st.nodeId);
        return comparePaths(p, best) > 0 ? p : best;
      }, undefined);
    const owner = idxs.reduce((a, b) => (comparePaths(bestParentPath(last.tracks[b]), bestParentPath(last.tracks[a])) > 0 ? b : a));

    const finished = (t: Track) => {
      const l = lastOf(t);
      if (l?.kind !== "node" || l.waiting) return false;
      if (l.joined) return true;
      return nodesById.get(l.nodeId)?.type === "end" || (outgoingEdges.get(l.nodeId) ?? []).length === 0;
    };
    const collapse = last.tracks.every((t, i) => idxs.includes(i) || finished(t));

    const tracks = last.tracks.map((t, i) => {
      if (!idxs.includes(i)) return t;
      const marker = lastOf(t) as NodeStep;
      const body = t.steps.slice(0, -1);
      if (!collapse && i === owner) return { ...t, steps: [...body, { kind: "node", nodeId: mergeId } as NodeStep] };
      return { ...t, steps: [...body, { ...marker, waiting: false, joined: true }] };
    });
    const rebuilt: Step[] = [...root.slice(0, -1), { ...last, tracks }];
    return collapse ? [...rebuilt, { kind: "node", nodeId: mergeId }] : rebuilt;
  }

  function withReleasedWaits(steps: Step[]): Step[] {
    const settle = (s: Step[]) => {
      const reached = new Set<string>();
      collectReachedNodes(s, reached);
      return releaseWaitingTracks(s, reached);
    };
    let current = settle(steps);
    for (let i = 0; i < 20; i++) {
      const next = releaseMerges(current);
      if (next === current) break;
      current = settle(next);
    }
    return current;
  }

  // Advances the step list at `path` by appending what comes after its last
  // step. `edgeTargets`/`branch` are only used when the last step is a
  // decision the user just chose a branch for; otherwise the next targets
  // are read directly from the graph.
  function advanceAt(path: Path, edgeTargets?: string[], branch?: string) {
    setRootSteps((prev) => {
      const updated = updateStepsAt(prev, path, (steps) => {
        const last = steps[steps.length - 1];
        if (!last || last.kind !== "node") return steps;
        const targets = edgeTargets ?? (outgoingEdges.get(last.nodeId) ?? []).map((e) => e.target);
        const reached = new Set<string>();
        collectReachedNodes(prev, reached);
        const frontier = new Set<string>();
        collectFrontier(prev, frontier, last);
        const own = new Set(steps.flatMap((st) => (st.kind === "node" ? [st.nodeId] : [])));
        const elsewhere = new Set([...reached].filter((id) => !own.has(id)));
        return extendSteps(steps, reached, frontier, targets, branch, path.length > 0, elsewhere);
      });
      return withReleasedWaits(updated);
    });
  }

  // Removes the last step, restoring any queue it was pulled from, and
  // un-joins tracks if a merge node that followed a split is being undone.
  function undoLast(steps: Step[]): Step[] {
    if (steps.length <= 1) return steps;
    const removed = steps[steps.length - 1];
    let out = steps.slice(0, -1);
    if (removed.kind === "node" && removed.restore) {
      const { index, queue } = removed.restore;
      out = out.map((st, i) => (i === index && st.kind === "node" ? { ...st, queue } : st));
    }
    const tail = out[out.length - 1];
    if (tail?.kind === "split") {
      out = [
        ...out.slice(0, -1),
        {
          ...tail,
          tracks: tail.tracks.map((t) => {
            const tl = t.steps[t.steps.length - 1];
            return tl?.kind === "node" && tl.joined ? { ...t, steps: t.steps.slice(0, -1) } : t;
          }),
        },
      ];
    }
    return out;
  }

  function goBackAt(path: Path) {
    setRootSteps((prev) => updateStepsAt(prev, path, undoLast));
  }

  function restart() {
    if (starts.length > 1) {
      setStartNodeId(null);
      setRootSteps([]);
      return;
    }
    setRootSteps(starts[0] ? [{ kind: "node", nodeId: starts[0].id }] : []);
  }

  function renderNodeCard(nodeId: string, branch: string | undefined, opts?: { compact?: boolean }) {
    const node = nodesById.get(nodeId);
    if (!node) return null;
    const edgesFromNode = outgoingEdges.get(nodeId) ?? [];
    const isEnd = node.type === "end" || edgesFromNode.length === 0;
    const nodeRoleColor = "roleId" in node.data ? roleColor(node.data.roleId) : undefined;
    const documentsHere = documentPresence.get(nodeId) ?? [];
    const binId = "binId" in node.data ? node.data.binId : undefined;
    const bin = binId ? bins.find((b) => b.id === binId) : undefined;
    const binLocation = bin ? locations.find((l) => l.id === bin.locationId) : undefined;

    // Decision cards match the editor: a solid fill in the assigned role/group
    // color with white text, or the soft amber look when nothing is assigned.
    const isDecisionCard = node.type === "decision";
    const fill = isDecisionCard ? assignedColor(node.data, roles, groups) : null;
    const onFill = Boolean(fill);

    return (
      <div
        className={`relative w-full rounded-2xl border shadow-lg ${opts?.compact ? "p-5" : "p-8"} ${
          onFill ? "border-transparent text-white" : isDecisionCard ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"
        }`}
        style={
          bin
            ? { borderColor: bin.color, borderWidth: 3, ...(fill ? { backgroundColor: fill } : {}) }
            : fill
              ? { backgroundColor: fill }
              : nodeRoleColor
              ? { borderLeftColor: nodeRoleColor, borderLeftWidth: 6 }
              : undefined
        }
      >
        {bin && (
          <span
            className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md"
            style={{ backgroundColor: bin.color }}
            title={`${bin.name} (${binLocation?.letter ?? "?"})`}
          >
            {binLocation?.letter ?? ""}
          </span>
        )}
        <div className="mb-4 flex items-center justify-between">
          <span
            className={
              onFill
                ? "rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white"
                : nodeRoleColor
                ? "rounded-full px-3 py-1 text-xs font-medium"
                : `rounded-full px-3 py-1 text-xs font-medium ${
                    node.type === "start"
                      ? "bg-emerald-100 text-emerald-700"
                      : node.type === "end"
                        ? "bg-rose-100 text-rose-700"
                        : node.type === "decision"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                  }`
            }
            style={!onFill && nodeRoleColor ? { backgroundColor: `${nodeRoleColor}1a`, color: nodeRoleColor } : undefined}
          >
            {nodeTypeLabel(node)}
          </span>
          {numberOf(nodeId) && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                onFill ? "border-white/50 text-white" : "border-slate-300 text-slate-500"
              }`}
            >
              {numberOf(nodeId)}
            </span>
          )}
        </div>

        <h2 className={`mb-2 font-semibold ${onFill ? "text-white" : "text-slate-900"} ${opts?.compact ? "text-lg" : "text-2xl"}`}>{node.data.label}</h2>

        {documentsHere.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {documentsHere.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                style={onFill ? { backgroundColor: "#ffffff", color: doc.color } : { backgroundColor: `${doc.color}1a`, color: doc.color }}
              >
                📄 {doc.name}
              </span>
            ))}
          </div>
        )}

        {bin && (
          <p className={`mb-3 flex items-center gap-2 text-sm ${onFill ? "text-white/80" : "text-slate-500"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/60" style={{ backgroundColor: bin.color }} />
            Place in bin: <span className={`font-medium ${onFill ? "text-white" : "text-slate-700"}`}>{bin.name}</span>
            {binLocation && <span className={onFill ? "text-white/70" : "text-slate-400"}>({binLocation.letter} · {binLocation.name})</span>}
          </p>
        )}

        {"roleId" in node.data && roleTitle(node.data.roleId) && (
          <p className={`mb-4 flex items-center gap-2 text-sm ${onFill ? "text-white/80" : "text-slate-500"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/60" style={{ backgroundColor: nodeRoleColor }} />
            Responsible: {roleTitle(node.data.roleId)}
          </p>
        )}

        {branch && (
          <p className={`mb-4 text-sm ${onFill ? "text-white/70" : "text-slate-400"}`}>
            You chose: <span className={`font-medium ${onFill ? "text-white" : "text-slate-600"}`}>{branch}</span>
          </p>
        )}

        {isEnd && (
          <p className={`mt-2 text-sm font-medium ${onFill ? "text-white" : "text-rose-600"}`}>
            {node.type === "end" ? "This path is complete." : "No further steps from here."}
          </p>
        )}
      </div>
    );
  }

  // Renders a stack of steps (either the top-level walkthrough or a single
  // track inside a split). `path` is this stack's location, used to target
  // updates precisely. `isScrollCandidate` marks the one track (per split)
  // whose active step the page should auto-scroll to.
  const reachedNow = new Set<string>();
  collectReachedNodes(rootSteps, reachedNow);

  function renderSteps(steps: Step[], path: Path, opts?: { compact?: boolean; isScrollCandidate?: boolean }) {
    return steps.map((step, i) => {
      const isLastInStack = i === steps.length - 1;
      const stepPath = [...path, i];

      if (step.kind === "node") {
        const node = nodesById.get(step.nodeId);
        const isWaitNode = node?.type === "wait";
        const edgesFromNode = outgoingEdges.get(step.nodeId) ?? [];
        const isDecision = node?.type === "decision";
        const isEnd = node?.type === "end" || edgesFromNode.length === 0;
        const branches = isDecision ? getDecisionBranches(outgoingEdges, step.nodeId) : [];
        // Answers the decision defines but that aren't wired to any next step.
        // They're shown (disabled) so a half-connected decision isn't a silent dead end.
        const definedAnswers = node?.type === "decision" ? (node.data.branches ?? []) : [];
        const unconnectedAnswers = definedAnswers.filter(
          (name, idx) => !branches.some((b) => b.key === `branch-${idx}` || b.label === name),
        );

        // A wait step shown here means its signal hasn't fired yet — the
        // wait node itself is never rendered as its own card. It's skipped
        // entirely; the previous real step (rendered on the prior iteration)
        // stays as the visible "current" card, and this just adds the
        // waiting indicator beneath it.
        if (isWaitNode && isLastInStack) {
          return (
            <p key={stepPath.join("-")} className="text-center text-xs text-slate-400">
              Waiting for another step to unlock this path&hellip;
            </p>
          );
        }

        // A merge node still waiting on another branch, or one that continued
        // in a different branch, is shown as a note instead of a card.
        if (step.waiting || step.joined) {
          return (
            <p key={stepPath.join("-")} className="text-center text-xs text-slate-400">
              {step.waiting
                ? `Waiting for the other path to reach ${numberOf(step.nodeId) ?? "the next step"}…`
                : `Continues with the other path at ${numberOf(step.nodeId) ?? "the next step"}.`}
            </p>
          );
        }

        const nextStep = steps[i + 1];
        const followedByWaitingMerge = nextStep?.kind === "node" && Boolean(nextStep.waiting);
        const hasQueue = steps.some((st) => st.kind === "node" && st.queue?.some((q) => !reachedNow.has(q)));
        const canAdvance = isLastInStack && !isDecision && (!isEnd || hasQueue);

        const isScrollTarget = isLastInStack && !isWaitNode && (opts?.isScrollCandidate ?? true);

        return (
          <div
            key={stepPath.join("-")}
            ref={isScrollTarget ? activeStepRef : undefined}
            className="flex w-full flex-col items-center gap-3"
          >
            {path.length === 0 && <span className="text-xs text-slate-400">Step {i + 1}</span>}
            {renderNodeCard(step.nodeId, step.branch, opts)}

            {isLastInStack && isDecision && branches.length > 0 && (
              <div className="flex w-full flex-col gap-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Choose an option</p>
                {branches.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => advanceAt(path, b.targets, b.label)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                  >
                    {b.label}
                  </button>
                ))}
                {unconnectedAnswers.map((name) => (
                  <button
                    key={`unconnected-${name}`}
                    disabled
                    title="This answer has no next step connected in the editor"
                    className="cursor-not-allowed rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left text-sm text-slate-400"
                  >
                    {name} <span className="text-xs">— no next step connected</span>
                  </button>
                ))}
                <button
                  onClick={() => goBackAt(path)}
                  disabled={steps.length <= 1}
                  className="mt-1 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &larr; Previous
                </button>
              </div>
            )}

            {followedByWaitingMerge && (
              <button
                onClick={() => goBackAt(path)}
                className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                &larr; Previous
              </button>
            )}

            {canAdvance && (
              <div className="flex w-full items-center justify-between">
                <button
                  onClick={() => goBackAt(path)}
                  disabled={steps.length <= 1}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &larr; Previous
                </button>
                <button
                  onClick={() => advanceAt(path)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
                >
                  {isEnd ? "Next path \u2192" : "Next \u2192"}
                </button>
              </div>
            )}

            {isLastInStack && !canAdvance && (isEnd || (isDecision && branches.length === 0)) && (
              <button
                onClick={() => goBackAt(path)}
                disabled={steps.length <= 1}
                className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                &larr; Previous
              </button>
            )}
          </div>
        );
      }

      // Split step: render each track's own step stack side by side. A
      // track that is waiting on a wait node, or that has reached its own
      // end, sticks near the top of the viewport so it stays visible while a
      // sibling track keeps going.
      return (
        <div key={stepPath.join("-")} className="flex w-full flex-col items-center gap-3">
          {path.length === 0 && <span className="text-xs text-slate-400">Step {i + 1} — parallel steps</span>}
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            {(() => {
              const firstActiveIndex = step.tracks.findIndex((t) => t.status === "active");
              return step.tracks.map((track, trackIndex) => {
                const trackPath = [...stepPath, trackIndex];
                const lastTrackStep = track.steps[track.steps.length - 1];
                const trackNode = lastTrackStep?.kind === "node" ? nodesById.get(lastTrackStep.nodeId) : undefined;
                const waiting = trackNode?.type === "wait";
                const trackEdges = lastTrackStep?.kind === "node" ? (outgoingEdges.get(lastTrackStep.nodeId) ?? []) : [];
                const trackEnded = !waiting && (trackNode?.type === "end" || trackEdges.length === 0);
                const parked = lastTrackStep?.kind === "node" && Boolean(lastTrackStep.waiting || lastTrackStep.joined);
                const sticky = waiting || trackEnded || parked;

                return (
                  <div key={track.id} className={`flex flex-col gap-3 ${sticky ? "sticky top-4 self-start" : ""}`}>
                    {track.label && (
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {track.label}
                      </span>
                    )}
                    {renderSteps(track.steps, trackPath, {
                      compact: true,
                      isScrollCandidate: trackIndex === firstActiveIndex,
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <button
          onClick={() => router.push(`/workflows/${id}`)}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          &larr; Back to editor
        </button>
        <div className="text-sm font-semibold text-slate-700">
          {chosenPath ? `${fullWorkflow.name} · ${chosenPath.name}` : fullWorkflow.name}
        </div>
        <div className="flex items-center gap-1">
          {savedPaths.length > 0 && (
            <button
              onClick={() => {
                setChosenPathId(undefined);
                setStartNodeId(null);
                setRootSteps([]);
              }}
              className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            >
              Change path
            </button>
          )}
          <button onClick={restart} className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Restart
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto p-8">
        <div className="flex w-full max-w-3xl flex-col items-center gap-6">{renderSteps(rootSteps, [])}</div>
      </div>
    </div>
  );
}
