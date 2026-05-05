import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ChecklistList } from "./ChecklistList";

export default async function ChecklistsPage() {
  const session = await getSession();
  const canCreate = session?.role !== "supervisor";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Plantillas de checklist</h1>
        {canCreate && (
          <Link
            href="/checklists/new"
            className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
          >
            Nueva plantilla
          </Link>
        )}
      </div>
      <ChecklistList canCreate={canCreate} />
    </div>
  );
}
