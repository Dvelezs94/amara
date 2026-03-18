import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getWorkOrderById } from "@/lib/work-orders";
import { WorkOrderForm } from "../../WorkOrderForm";

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wo = await getWorkOrderById(id);
  if (!wo) notFound();
  if (wo.status === "completed") redirect(`/work-orders/${id}`);
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Editar orden de trabajo</h1>
      <WorkOrderForm
        workOrderId={id}
        initial={{
          title: wo.title,
          description: wo.description ?? undefined,
          status: wo.status,
          priority: wo.priority,
          assetId: wo.assetId ?? undefined,
          assigneeId: wo.assigneeId ?? undefined,
          dueDate: wo.dueDate ? new Date(wo.dueDate).toISOString().slice(0, 16) : undefined,
        }}
      />
      <Link
        href={`/work-orders/${id}`}
        className="block text-center text-sm text-primary-600"
      >
        Volver a la orden
      </Link>
    </div>
  );
}
