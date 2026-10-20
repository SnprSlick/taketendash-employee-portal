import { assignedColor, assignedTitle } from "@/lib/workflow/flow/assignedRoles";
import { buildAdjacency, edgeLabel, getWaitSignalSource } from "@/lib/workflow/flow/lanes";
import { analyzeFlow, comparePaths, formatStepNumber } from "@/lib/workflow/flow/numbering";
import type { Bin, FlowEdge, FlowNode, Location, Role, RoleGroup } from "@/lib/workflow/flow/types";

export type OutlineTag = {
  roleTitle: string | null;
  roleColor: string | null;
  binLabel: string | null;
  binColor: string | null;
};

const EMPTY_TAG: OutlineTag = { roleTitle: null, roleColor: null, binLabel: null, binColor: null };

// Where to go after a section. `answer` is the decision choice that leads
// there (null for a plain "next"); `tag` is the bin the target is placed in.
export type OutlineLink = {
  answer: string | null;
  number: string;
  tag: OutlineTag;
  // True when the target is not part of an exported selection, so the reader
  // knows the next step lives outside this document.
  outside: boolean;
};

// One numbered section of the document. The outline is a flat list in number
// order (1.0.0, 1.1.0, 1.2.0, 1.2.1, ...): a reader follows the links to jump
// to the next section by its number instead of following nested indentation.
export type OutlineSection = {
  number: string;
  kind: "start" | "step" | "decision" | "end" | "wait" | "subworkflow";
  label: string;
  tag: OutlineTag;
  links: OutlineLink[];
  // True when a non-decision section continues into several sections at once.
  parallel: boolean;
  // For a wait node: the section whose completion unblocks it.
  waitFor: string | null;
  // On the step that unblocks a wait node: the wait, and where the flow
  // picks back up once it is released.
  releases?: { waitNumber: string; continueAt: string[] }[];
  // For a sub-workflow node: its own workflow, numbered on its own.
  subworkflow?: { name: string; missing: boolean; sections: OutlineSection[] };
};

export type WorkflowGraphLookup = (
  workflowId: string,
) => { name: string; nodes: FlowNode[]; edges: FlowEdge[] } | undefined;

export function generateOutline(
  nodes: FlowNode[],
  edges: FlowEdge[],
  roles: Role[] = [],
  bins: Bin[] = [],
  locations: Location[] = [],
  groups: RoleGroup[] = [],
  lookupWorkflow: WorkflowGraphLookup = () => undefined,
  ancestryWorkflowIds: string[] = [],
  // Export only these nodes. Numbers still come from the whole workflow so a
  // partial export lines up with the editor and the full PDF.
  includeNodeIds?: Set<string>,
  // Only list these connections as options (a path can leave some out).
  includeEdgeIds?: Set<string>,
): OutlineSection[] {
  const { paths, parents, forwardTargets, backEdgeIds } = analyzeFlow(nodes, edges);
  const outgoing = buildAdjacency(edges);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const numberFor = (nodeId: string) => {
    const path = paths.get(nodeId);
    return path ? formatStepNumber(path) : "?";
  };

  const tagFor = (node: FlowNode): OutlineTag => {
    if (node.type === "subworkflow") return EMPTY_TAG;
    const bin = bins.find((b) => b.id === node.data.binId);
    const location = bin ? locations.find((l) => l.id === bin.locationId) : undefined;
    return {
      roleTitle: assignedTitle(node.data, roles, groups),
      roleColor: assignedColor(node.data, roles, groups),
      binLabel: bin ? `${bin.name} (${location?.name ?? "Unknown location"})` : null,
      binColor: bin ? bin.color : null,
    };
  };

  const included = includeNodeIds ? nodes.filter((n) => includeNodeIds.has(n.id)) : nodes;
  const sections = included.map((node): OutlineSection => {
    const outs = (outgoing.get(node.id) ?? []).filter(
      (e) => nodesById.has(e.target) && (!includeEdgeIds || includeEdgeIds.has(e.id)),
    );
    const isDecision = node.type === "decision";
    const links: OutlineLink[] = outs.map((edge) => ({
      answer: isDecision ? edgeLabel(edge) : null,
      number: numberFor(edge.target),
      tag: tagFor(nodesById.get(edge.target)!),
      outside: includeNodeIds ? !includeNodeIds.has(edge.target) : false,
    }));

    const section: OutlineSection = {
      number: numberFor(node.id),
      kind: node.type === "subworkflow" ? "subworkflow" : (node.type as OutlineSection["kind"]),
      label: node.data.label,
      tag: tagFor(node),
      links,
      parallel: !isDecision && links.length > 1,
      waitFor: null,
    };

    if (node.type === "wait") {
      const source = getWaitSignalSource(edges, node.id);
      section.waitFor = source ? numberFor(source) : null;
    }

    if (node.type === "subworkflow") {
      const refId = node.data.refWorkflowId;
      const ref = refId ? lookupWorkflow(refId) : undefined;
      // A circular reference should be blocked at save time; guard anyway so
      // export never recurses forever.
      const circular = refId ? ancestryWorkflowIds.includes(refId) : false;
      section.subworkflow = {
        name: ref?.name ?? "(missing sub-workflow)",
        missing: !ref,
        sections:
          ref && refId && !circular
            ? generateOutline(ref.nodes, ref.edges, roles, bins, locations, groups, lookupWorkflow, [
                ...ancestryWorkflowIds,
                refId,
              ])
            : [],
      };
    }
    return section;
  });

  // A wait node breaks its line; the step wired into its signal handle
  // releases it, and the flow resumes at whatever follows the wait.
  const sectionByNumber = new Map(sections.map((s) => [s.number, s]));
  sections.forEach((wait) => {
    if (wait.kind !== "wait" || !wait.waitFor) return;
    const source = sectionByNumber.get(wait.waitFor);
    const continueAt = wait.links.filter((l) => !l.outside).map((l) => l.number);
    if (!source || continueAt.length === 0) return;
    source.releases = [...(source.releases ?? []), { waitNumber: wait.number, continueAt }];
  });

  // Reading order follows the flow rather than the numbers: each step is
  // followed directly by the step it leads to, so the reader rarely has to
  // jump. A split's short dead-end branches come first, then the branch that
  // carries on; a merge waits until every branch leading into it is placed.
  const order = new Map<string, number>();
  const inScope = (id: string) => !includeNodeIds || includeNodeIds.has(id);
  const scopedParents = (id: string) => (parents.get(id) ?? []).filter(inScope);
  // A loop-back edge is only an ordering hint when nothing selected leads
  // into its target: then the target follows the step that loops back to it.
  const loopKids = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!backEdgeIds.has(e.id) || !inScope(e.source) || !inScope(e.target) || scopedParents(e.target).length > 0) return;
    loopKids.set(e.source, [...(loopKids.get(e.source) ?? []), e.target]);
  });
  const loopTargets = new Set([...loopKids.values()].flat());
  const byNumber = [...nodes].sort((a, b) => comparePaths(paths.get(a.id), paths.get(b.id)));
  const startIds = byNumber
    .filter((n) => inScope(n.id) && scopedParents(n.id).length === 0 && !loopTargets.has(n.id))
    .map((n) => n.id);
  // Steps reachable from a real start. A merge doesn't wait for a branch that
  // only exists downstream of a loop-back (it would wait on itself forever).
  const fromStarts = new Set<string>();
  const reach = (id: string) => {
    if (fromStarts.has(id)) return;
    fromStarts.add(id);
    (forwardTargets.get(id) ?? []).filter(inScope).forEach(reach);
  };
  startIds.forEach(reach);
  const placeNode = (id: string, force = false) => {
    if (order.has(id) || !inScope(id)) return;
    if (!force && scopedParents(id).some((p) => !order.has(p) && fromStarts.has(p))) return;
    order.set(id, order.size);
    const kids = (forwardTargets.get(id) ?? []).filter(inScope);
    const isDeadEnd = (k: string) =>
      (forwardTargets.get(k) ?? []).length === 0 && !loopKids.has(k) && scopedParents(k).length <= 1;
    [...kids.filter(isDeadEnd), ...kids.filter((k) => !isDeadEnd(k)), ...(loopKids.get(id) ?? [])].forEach((k) => placeNode(k));
  };
  // Starts (nothing selected leads into them) first, in number order.
  startIds.forEach((id) => placeNode(id));
  // Anything still unplaced (e.g. a merge whose other branch is unreachable).
  byNumber.forEach((n) => placeNode(n.id, true));

  const byId = new Map(included.map((n, i) => [sections[i], n.id]));
  return sections.sort((a, b) => (order.get(byId.get(a)!) ?? 0) - (order.get(byId.get(b)!) ?? 0));
}
