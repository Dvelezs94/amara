import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowDefinitions, workflowRuns } from "@/lib/db/schema";
import {
  coerceStoredTriggerConfig,
  coerceStoredWorkflowActions,
  isWorkflowTriggerType,
} from "@/lib/workflows";
import { SetPageHeader } from "@/components/SetPageHeader";
import { WorkflowViewer } from "../WorkflowViewer";

export default async function FlujoViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        No tienes permisos para administrar flujos.
      </div>
    );
  }

  const { id } = await params;
  const row = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, id),
  });
  if (!row || !isWorkflowTriggerType(row.triggerType)) notFound();

  const runs = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      error: workflowRuns.error,
      createdAt: workflowRuns.createdAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, id))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(12);

  const triggerConfig = coerceStoredTriggerConfig(row.triggerConfig);

  return (
    <div className="-mx-4 -mb-4 flex h-[calc(100dvh-7.25rem)] min-h-[32rem] flex-col">
      <SetPageHeader
        title={row.name}
        subtitle={row.description || undefined}
        filters={
          <Link
            href="/flujos"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#F14C03] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Flujos
          </Link>
        }
        actions={
          <Link
            href={`/flujos/${row.id}/edit`}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Editar
          </Link>
        }
      />
      <WorkflowViewer
        workflowId={row.id}
        enabled={row.enabled}
        triggerType={row.triggerType}
        toStatus={triggerConfig.toStatus ?? ""}
        actions={coerceStoredWorkflowActions(row.actions)}
        runs={runs}
      />
    </div>
  );
}
