import type { Workflow } from "@prisma/client";
import type { WorkflowRecord, WorkflowSummary } from "./types";

export function toWorkflowRecord(w: Workflow): WorkflowRecord {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    category: w.category,
    isTemplate: w.isTemplate,
    nodes: JSON.parse(w.nodes),
    edges: JSON.parse(w.edges),
    notes: JSON.parse(w.notes),
    documents: JSON.parse(w.documents),
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function toWorkflowSummary(w: Workflow): WorkflowSummary {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    category: w.category,
    isTemplate: w.isTemplate,
    updatedAt: w.updatedAt.toISOString(),
  };
}
