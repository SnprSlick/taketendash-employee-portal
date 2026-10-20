import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toPathRecord, cleanNodeIds, cleanEdgeIds } from "@/lib/workflow/flow/paths";

type Params = { params: Promise<{ id: string; pathId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, pathId } = await params;
  const body = await request.json().catch(() => ({}));
  const existing = await prisma.workflowPath.findFirst({ where: { id: pathId, workflowId: id } });
  if (!existing) return NextResponse.json({ error: "Path not found" }, { status: 404 });

  const data: { name?: string; nodeIds?: string; edgeIds?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.nodeIds !== undefined) {
    const nodeIds = cleanNodeIds(body.nodeIds);
    if (nodeIds.length === 0) return NextResponse.json({ error: "A path needs at least one node" }, { status: 400 });
    data.nodeIds = JSON.stringify(nodeIds);
  }
  if (body.edgeIds !== undefined) data.edgeIds = Array.isArray(body.edgeIds) ? JSON.stringify(cleanEdgeIds(body.edgeIds)) : null;
  const updated = await prisma.workflowPath.update({ where: { id: pathId }, data });
  return NextResponse.json(toPathRecord(updated));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, pathId } = await params;
  await prisma.workflowPath.deleteMany({ where: { id: pathId, workflowId: id } });
  return NextResponse.json({ ok: true });
}
