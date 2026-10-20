// Sub-workflow references form a graph of workflow-id -> referenced workflow-ids.
// A cycle here means workflow A embeds B which (directly or transitively) embeds A again —
// which would make PDF export and canvas drill-in recurse forever.
export function wouldCreateSubworkflowCycle(startId: string, graph: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const refId of graph.get(id) ?? []) {
      if (dfs(refId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return dfs(startId);
}
