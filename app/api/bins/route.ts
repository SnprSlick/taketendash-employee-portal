import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET() {
  const bins = await prisma.bin.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(bins);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled bin";
  const color = typeof body.color === "string" && body.color ? body.color : "#3b82f6";
  const locationId = typeof body.locationId === "string" ? body.locationId : null;

  if (!locationId) {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const bin = await prisma.bin.create({ data: { name, color, locationId } });
  return NextResponse.json(bin, { status: 201 });
}
