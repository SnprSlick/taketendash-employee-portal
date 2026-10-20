// Saved "paths": named sets of node ids within one workflow, exportable to PDF.
export type WorkflowPathRecord = {
  id: string;
  workflowId: string;
  name: string;
  nodeIds: string[];
  // null = every connection between the path's nodes (older paths).
  edgeIds: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export function cleanNodeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string"))];
}

// null/absent stays null (all connections); an array keeps just those.
export function cleanEdgeIds(value: unknown): string[] | null {
  return Array.isArray(value) ? cleanNodeIds(value) : null;
}

export function toPathRecord(row: {
  id: string;
  workflowId: string;
  name: string;
  nodeIds: string;
  edgeIds: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowPathRecord {
  let nodeIds: string[] = [];
  try {
    nodeIds = cleanNodeIds(JSON.parse(row.nodeIds));
  } catch {}
  let edgeIds: string[] | null = null;
  try {
    edgeIds = row.edgeIds ? cleanEdgeIds(JSON.parse(row.edgeIds)) : null;
  } catch {}
  return {
    id: row.id,
    workflowId: row.workflowId,
    name: row.name,
    nodeIds,
    edgeIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
