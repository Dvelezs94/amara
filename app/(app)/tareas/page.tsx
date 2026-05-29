import { redirect } from "next/navigation";
import { WorkOrderList } from "./WorkOrderList";
import { TareasPageHeader } from "./TareasPageHeader";
import { getSession } from "@/lib/auth";

export default async function WorkOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-4">
      <TareasPageHeader isAdmin={session.role === "admin"} />
      <WorkOrderList />
    </div>
  );
}
