import Link from "next/link";
import { ChecklistList } from "./ChecklistList";

export default function ChecklistsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Plantillas de checklist</h1>
        <Link
          href="/checklists/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Nueva plantilla
        </Link>
      </div>
      <ChecklistList />
    </div>
  );
}
