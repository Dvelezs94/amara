import Link from "next/link";
import { WorkOrderList } from "./WorkOrderList";

export default function WorkOrdersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Órdenes de trabajo</h1>
        <Link
          href="/work-orders/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Nueva orden
        </Link>
      </div>
      <WorkOrderList />
    </div>
  );
}
