import { notFound } from "next/navigation";
import { getWorkOrderById } from "@/lib/work-orders";
import { WorkOrderDetail } from "./WorkOrderDetail";
import { getSession } from "@/lib/auth";
import { canDeleteWorkOrder } from "@/lib/auth-shared";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const wo = await getWorkOrderById(id);
  if (!wo) notFound();

  return (
    <WorkOrderDetail
      initial={wo}
      canEditAssignee={session?.role === "admin"}
      canEditCompletedAt={session?.role === "admin"}
      canEditChecklistWhenLocked={
        session?.role === "admin" || session?.role === "calidad"
      }
      canDeleteWorkOrder={canDeleteWorkOrder(session?.role)}
    />
  );
}
