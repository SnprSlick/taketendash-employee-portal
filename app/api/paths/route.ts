import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { toPathRecord } from "@/lib/workflow/flow/paths";

// Every saved path across all workflows, with its workflow's name (bulk export).
export async function GET() {
  const paths = await prisma.workflowPath.findMany({
    orderBy: { createdAt: "asc" },
    include: { workflow: { select: { name: true } } },
  });
  return NextResponse.json(paths.map((p) => ({ ...toPathRecord(p), workflowName: p.workflow.name })));
}
