import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkOrderById } from "@/lib/work-orders";
import { WorkOrderDetail } from "./WorkOrderDetail";
import { getSession } from "@/lib/auth";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const wo = await getWorkOrderById(id);
  if (!wo) notFound();
  const isCompleted = wo.status === "completed";

  return (
    <div className="space-y-4">
      <WorkOrderDetail
        initial={wo}
        canEditAssignee={session?.role === "admin"}
      />
      <div className="flex gap-2">
        {!isCompleted && (
          <Link
            href={`/work-orders/${id}/edit`}
            className="rounded-xl border border-zinc-300 py-2.5 px-4 text-sm font-medium text-zinc-700 tap-target"
          >
            Editar
          </Link>
        )}
        <Link
          href="/work-orders"
          className="rounded-xl border border-zinc-300 py-2.5 px-4 text-sm font-medium text-zinc-700 tap-target"
        >
          Volver al listado
        </Link>
      </div>
    </div>
  );
}
