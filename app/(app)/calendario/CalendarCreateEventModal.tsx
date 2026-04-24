"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CreateMaintenanceEventForm } from "./CreateMaintenanceEventForm";

type SelectOption = { id: string; name: string; sublabel?: string };

export function CalendarCreateEventModal({
  assets,
  users,
  checklistTemplates,
  open,
  onOpenChange,
  initialStartDate,
  hideTrigger = false,
}: {
  assets: SelectOption[];
  users: SelectOption[];
  checklistTemplates: SelectOption[];
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  initialStartDate?: string;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  function setOpen(next: boolean) {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  }

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-sm bg-primary-600 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:bg-primary-700"
        >
          Crear evento
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Nuevo evento de mantenimiento</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar modal"
                className="rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <CreateMaintenanceEventForm
                assets={assets}
                users={users}
                checklistTemplates={checklistTemplates}
                initialStartDate={initialStartDate}
                onCreated={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
