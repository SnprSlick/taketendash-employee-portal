import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET() {
  const groups = await prisma.roleGroup.findMany({
    orderBy: { createdAt: "asc" },
    include: { roles: true },
  });
  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled group";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const color = typeof body.color === "string" && body.color ? body.color : "#3b82f6";
  const roleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds : [];

  const group = await prisma.roleGroup.create({
    data: {
      title,
      description,
      color,
      roles: { connect: roleIds.map((id) => ({ id })) },
    },
    include: { roles: true },
  });
  return NextResponse.json(group, { status: 201 });
}
