import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof body.letter === "string") data.letter = body.letter.trim().slice(0, 2).toUpperCase();
  if (typeof body.name === "string") data.name = body.name;

  const location = await prisma.location.update({ where: { id }, data });
  return NextResponse.json(location);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
