"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CreateMaintenanceEventForm } from "./CreateMaintenanceEventForm";

type SelectOption = { id: string; name: string; sublabel?: string };

export function CalendarCreateEventModal({
  assets,
  users,
  checklistTemplates,
}: {
  assets: SelectOption[];
  users: SelectOption[];
  checklistTemplates: SelectOption[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-sm bg-primary-600 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:bg-primary-700"
      >
        Crear evento
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar modal"
              className="absolute right-3 top-3 rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
            <CreateMaintenanceEventForm
              assets={assets}
              users={users}
              checklistTemplates={checklistTemplates}
              onCreated={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
