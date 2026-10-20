import { prisma } from "@/app/lib/db";
import { toWorkflowRecord, toWorkflowSummary } from "@/lib/workflow/flow/serialize";
import { notFound } from "next/navigation";
import { PrintCanvas } from "@/components/workflow/canvas/PrintCanvas";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workflow, roles, bins, locations, allWorkflows] = await Promise.all([
    prisma.workflow.findUnique({ where: { id } }),
    prisma.role.findMany(),
    prisma.bin.findMany(),
    prisma.location.findMany(),
    prisma.workflow.findMany(),
  ]);
  if (!workflow) notFound();

  const record = toWorkflowRecord(workflow);
  const subworkflows = allWorkflows.map(toWorkflowSummary);

  return (
    <div style={{ width: 1600, height: 1000 }}>
      <PrintCanvas
        nodes={record.nodes}
        edges={record.edges}
        roles={roles}
        bins={bins}
        locations={locations}
        subworkflows={subworkflows}
      />
    </div>
  );
}
