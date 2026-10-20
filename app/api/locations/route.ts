import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: "asc" },
    include: { bins: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const letter = typeof body.letter === "string" && body.letter.trim() ? body.letter.trim().slice(0, 2).toUpperCase() : "A";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled location";

  const location = await prisma.location.create({ data: { letter, name } });
  return NextResponse.json({ ...location, bins: [] }, { status: 201 });
}
