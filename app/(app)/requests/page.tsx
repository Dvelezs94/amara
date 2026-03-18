import Link from "next/link";
import { RequestList } from "./RequestList";

export default function RequestsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Solicitudes</h1>
        <Link
          href="/requests/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Nueva solicitud
        </Link>
      </div>
      <RequestList />
    </div>
  );
}
