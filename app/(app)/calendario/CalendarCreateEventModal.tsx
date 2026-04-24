"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSheetModalPresence } from "@/lib/use-sheet-modal-presence";
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
  const { mounted, show, onPanelTransitionEnd } = useSheetModalPresence(isOpen);

  function setOpen(next: boolean) {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  }

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

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

      {mounted && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 transition-opacity duration-300 ease-out motion-reduce:transition-none md:items-center md:justify-center md:p-4 ${
            show ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        >
          <div
            className={`relative flex max-h-[min(90dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 md:max-h-[85vh] md:rounded-lg md:border-b md:shadow-lg ${
            show
              ? "translate-y-0 motion-reduce:translate-y-0"
              : "translate-y-full motion-reduce:translate-y-0 md:translate-y-4"
          }`}
            onClick={(e) => e.stopPropagation()}
            onTransitionEnd={onPanelTransitionEnd}
          >
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 md:hidden"
              aria-hidden
            />
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Nuevo evento de mantenimiento</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar modal"
                className="inline-flex items-center justify-center rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
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
