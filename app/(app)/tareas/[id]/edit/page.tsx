import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getWorkOrderById } from "@/lib/work-orders";
import { WorkOrderForm } from "../../WorkOrderForm";
import { getSession } from "@/lib/auth";

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const wo = await getWorkOrderById(id);
  if (!wo) notFound();
  if (wo.status === "completed") redirect(`/tareas/${id}`);
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <WorkOrderForm
        workOrderId={id}
        canEditAssignee={session.role === "admin"}
        initial={{
          title: wo.title,
          description: wo.description ?? undefined,
          status: wo.status,
          priority: wo.priority,
          assetId: wo.assetId ?? undefined,
          assigneeIds: wo.assigneeIds ?? [],
          dueDate: wo.dueDate ? new Date(wo.dueDate).toISOString().slice(0, 16) : undefined,
          startDate: wo.startDate
            ? new Date(wo.startDate).toISOString().slice(0, 10)
            : undefined,
          countsMachineDowntime: wo.countsMachineDowntime === true,
          manualDowntimeMinutes: wo.manualDowntimeMinutes ?? 0,
        }}
      />
      <Link
        href={`/tareas/${id}`}
        className="block text-center text-sm text-primary-600"
      >
        Volver a la tarea
      </Link>
    </div>
  );
}
