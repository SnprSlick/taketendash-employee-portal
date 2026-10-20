import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toWorkflowRecord } from "@/lib/workflow/flow/serialize";
import { wouldCreateSubworkflowCycle } from "@/lib/workflow/flow/subworkflowCycle";
import type { FlowNode } from "@/lib/workflow/flow/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  return NextResponse.json(toWorkflowRecord(workflow));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.description === "string" || body.description === null) data.description = body.description;
  if (typeof body.category === "string" || body.category === null) data.category = body.category;
  if (typeof body.isTemplate === "boolean") data.isTemplate = body.isTemplate;
  if (Array.isArray(body.notes)) data.notes = JSON.stringify(body.notes);
  if (Array.isArray(body.documents)) data.documents = JSON.stringify(body.documents);

  if (Array.isArray(body.nodes)) {
    const refIds = (body.nodes as FlowNode[])
      .filter((n): n is Extract<FlowNode, { type: "subworkflow" }> => n.type === "subworkflow")
      .map((n) => n.data.refWorkflowId)
      .filter((v): v is string => Boolean(v));

    if (refIds.length > 0) {
      const allWorkflows = await prisma.workflow.findMany({ select: { id: true, nodes: true } });
      const graphs = new Map(
        allWorkflows.map((w) => [
          w.id,
          (JSON.parse(w.nodes) as FlowNode[])
            .filter((n): n is Extract<FlowNode, { type: "subworkflow" }> => n.type === "subworkflow")
            .map((n) => n.data.refWorkflowId)
            .filter((v): v is string => Boolean(v)),
        ]),
      );
      graphs.set(id, refIds);

      if (wouldCreateSubworkflowCycle(id, graphs)) {
        return NextResponse.json(
          { error: "This would create a circular sub-workflow reference (a workflow cannot include itself, directly or transitively)." },
          { status: 400 },
        );
      }
    }

    data.nodes = JSON.stringify(body.nodes);
  }
  if (Array.isArray(body.edges)) data.edges = JSON.stringify(body.edges);

  const workflow = await prisma.workflow.update({ where: { id }, data });
  return NextResponse.json(toWorkflowRecord(workflow));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const referencingWorkflows = await prisma.workflow.findMany({ select: { id: true, name: true, nodes: true } });
  const referencedBy = referencingWorkflows.filter((w) => {
    if (w.id === id) return false;
    const nodes = JSON.parse(w.nodes) as FlowNode[];
    return nodes.some((n) => n.type === "subworkflow" && n.data.refWorkflowId === id);
  });

  if (referencedBy.length > 0) {
    return NextResponse.json(
      {
        error: "This workflow is used as a sub-workflow elsewhere and can't be deleted.",
        referencedBy: referencedBy.map((w) => ({ id: w.id, name: w.name })),
      },
      { status: 409 },
    );
  }

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
