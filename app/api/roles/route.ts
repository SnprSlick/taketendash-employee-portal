import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET() {
  const roles = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(roles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled role";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const color = typeof body.color === "string" && body.color ? body.color : "#3b82f6";

  const role = await prisma.role.create({ data: { title, description, color } });
  return NextResponse.json(role, { status: 201 });
}
