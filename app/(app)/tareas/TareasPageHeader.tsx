"use client";

import Link from "next/link";
import { WorkOrderStatusColorsSettings } from "@/components/WorkOrderStatusColorsSettings";

export function TareasPageHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-zinc-900">Tareas</h1>
      <div className="flex shrink-0 items-center gap-2">
        {isAdmin ? <WorkOrderStatusColorsSettings /> : null}
        <Link
          href="/tareas/new"
          className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target"
        >
          Nueva tarea
        </Link>
      </div>
    </div>
  );
}
