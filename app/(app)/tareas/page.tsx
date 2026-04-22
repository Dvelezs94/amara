import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkOrderList } from "./WorkOrderList";
import { getSession } from "@/lib/auth";

export default async function WorkOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Tareas</h1>
        <Link
          href="/tareas/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Nueva tarea
        </Link>
      </div>
      <WorkOrderList />
    </div>
  );
}
