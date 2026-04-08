import { notFound } from "next/navigation";
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

  return (
    <WorkOrderDetail
      initial={wo}
      canEditAssignee={session?.role === "admin"}
    />
  );
}
