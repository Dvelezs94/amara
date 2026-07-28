"use client";

import Link from "next/link";
import { WorkOrderStatusColorsSettings } from "@/components/WorkOrderStatusColorsSettings";
import { useSetPageHeader } from "@/components/PageHeaderContext";

export function TareasPageHeader({ isAdmin }: { isAdmin: boolean }) {
  useSetPageHeader({
    title: "Tareas",
    actions: (
      <>
        {isAdmin ? <WorkOrderStatusColorsSettings /> : null}
        <Link
          href="/tareas/new"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white tap-target hover:bg-primary-700"
        >
          Nueva tarea
        </Link>
      </>
    ),
  });
  return null;
}
