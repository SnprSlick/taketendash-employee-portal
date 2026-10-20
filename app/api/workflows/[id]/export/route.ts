import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toWorkflowRecord } from "@/lib/workflow/flow/serialize";
import { generateOutline, type WorkflowGraphLookup } from "@/lib/workflow/pdf/generateOutline";
import { renderWorkflowPdf } from "@/lib/workflow/pdf/renderPdf";
import type { FlowEdge, FlowNode } from "@/lib/workflow/flow/types";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Optional body: { nodeIds?: string[]; fileName?: string; title?: string }. No body (or no
  // nodeIds) exports the whole workflow.
  const body = (await request.json().catch(() => ({}))) as { nodeIds?: unknown; fileName?: unknown; title?: unknown; edgeIds?: unknown };
  const nodeIds = Array.isArray(body.nodeIds) ? body.nodeIds.filter((v): v is string => typeof v === "string") : [];
  const [workflow, roles, bins, locations, groups, allWorkflows] = await Promise.all([
    prisma.workflow.findUnique({ where: { id } }),
    prisma.role.findMany(),
    prisma.bin.findMany(),
    prisma.location.findMany(),
    prisma.roleGroup.findMany({ include: { roles: true } }),
    prisma.workflow.findMany({ select: { id: true, name: true, nodes: true, edges: true } }),
  ]);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const workflowsById = new Map(allWorkflows.map((w) => [w.id, w]));
  const lookupWorkflow: WorkflowGraphLookup = (workflowId) => {
    const w = workflowsById.get(workflowId);
    if (!w) return undefined;
    return { name: w.name, nodes: JSON.parse(w.nodes) as FlowNode[], edges: JSON.parse(w.edges) as FlowEdge[] };
  };

  const record = toWorkflowRecord(workflow);
  const knownIds = new Set(record.nodes.map((n) => n.id));
  const selected = new Set(nodeIds.filter((nid) => knownIds.has(nid)));
  if (nodeIds.length > 0 && selected.size === 0) {
    return NextResponse.json({ error: "None of the selected nodes exist in this workflow" }, { status: 400 });
  }
  // Optional: only these connections are listed as "go to" options.
  const selectedEdges = Array.isArray(body.edgeIds)
    ? new Set(body.edgeIds.filter((v): v is string => typeof v === "string"))
    : undefined;
  const partial = selected.size > 0 && selected.size < record.nodes.length;
  const outline = generateOutline(
    record.nodes,
    record.edges,
    roles,
    bins,
    locations,
    groups,
    lookupWorkflow,
    [id],
    partial ? selected : undefined,
    selectedEdges,
  );

  const pdfBuffer = await renderWorkflowPdf({
    workflowName: partial && typeof body.title === "string" && body.title.trim() ? body.title.trim() : record.name,
    outline,
    notes: partial ? [] : record.notes,
    roles,
    subtitle: partial ? "" : undefined,
  });

  return pdfResponse(pdfBuffer, body.fileName, record.name);
}

function pdfResponse(pdf: Buffer, fileName: unknown, fallbackName: string) {
  const requested = typeof fileName === "string" ? fileName : "";
  const baseName =
    requested
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9-_ .()]/gi, "")
      .trim() ||
    fallbackName.replace(/[^a-z0-9-_ ]/gi, "").trim() ||
    "workflow";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
    },
  });
}
