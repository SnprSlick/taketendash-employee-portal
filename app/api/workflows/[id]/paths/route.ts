import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toPathRecord, cleanNodeIds, cleanEdgeIds } from "@/lib/workflow/flow/paths";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const paths = await prisma.workflowPath.findMany({ where: { workflowId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(paths.map(toPathRecord));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nodeIds = cleanNodeIds(body.nodeIds);
  if (!name) return NextResponse.json({ error: "A path needs a name" }, { status: 400 });
  if (nodeIds.length === 0) return NextResponse.json({ error: "A path needs at least one node" }, { status: 400 });
  const workflow = await prisma.workflow.findUnique({ where: { id }, select: { id: true } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  const created = await prisma.workflowPath.create({
    data: {
      workflowId: id,
      name,
      nodeIds: JSON.stringify(nodeIds),
      edgeIds: Array.isArray(body.edgeIds) ? JSON.stringify(cleanEdgeIds(body.edgeIds)) : null,
    },
  });
  return NextResponse.json(toPathRecord(created), { status: 201 });
}
