import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.description === "string" || body.description === null) data.description = body.description;
  if (typeof body.color === "string") data.color = body.color;
  if (Array.isArray(body.roleIds)) {
    data.roles = { set: body.roleIds.map((roleId: string) => ({ id: roleId })) };
  }

  const group = await prisma.roleGroup.update({ where: { id }, data, include: { roles: true } });
  return NextResponse.json(group);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.roleGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
