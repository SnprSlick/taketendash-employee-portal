import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toWorkflowSummary } from "@/lib/workflow/flow/serialize";

export async function GET(request: NextRequest) {
  const templatesOnly = request.nextUrl.searchParams.get("templates") === "1";
  const workflows = await prisma.workflow.findMany({
    where: templatesOnly ? { isTemplate: true } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(workflows.map(toWorkflowSummary));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled workflow";
  const category = typeof body.category === "string" ? body.category.trim() || null : null;
  const isTemplate = body.isTemplate === true;

  const defaultNodes = [
    {
      id: "start",
      type: "step",
      position: { x: 250, y: 80 },
      data: { label: "Start: describe the first thing that happens" },
    },
  ];

  const nodes = Array.isArray(body.nodes) ? body.nodes : defaultNodes;
  const edges = Array.isArray(body.edges) ? body.edges : [];

  const workflow = await prisma.workflow.create({
    data: {
      name,
      category,
      isTemplate,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
    },
  });

  return NextResponse.json(toWorkflowSummary(workflow), { status: 201 });
}
