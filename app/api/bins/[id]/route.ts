import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.color === "string") data.color = body.color;
  if (typeof body.locationId === "string") data.locationId = body.locationId;

  const bin = await prisma.bin.update({ where: { id }, data });
  return NextResponse.json(bin);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.bin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
