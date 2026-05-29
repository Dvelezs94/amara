"use client";

import { useEffect, useState } from "react";
import { Settings, X } from "lucide-react";
import { useWorkOrderStatusColors } from "@/components/WorkOrderStatusColorsProvider";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  WORK_ORDER_STATUS_KEYS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatusColors,
} from "@/lib/work-order-status-colors";

export function WorkOrderStatusColorsSettings() {
  const { colors, setColors, refreshColors } = useWorkOrderStatusColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkOrderStatusColors>(colors);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft(colors);
  }, [open, colors]);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/app-settings/work-order-status-colors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "No se pudo guardar"
        );
        return;
      }
      if (data?.colors) {
        setColors({ ...DEFAULT_WORK_ORDER_STATUS_COLORS, ...data.colors });
      } else {
        setColors(draft);
      }
      await refreshColors();
      setOpen(false);
    } catch {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setDraft({ ...DEFAULT_WORK_ORDER_STATUS_COLORS });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white p-2.5 text-zinc-700 hover:bg-zinc-50"
        aria-label="Colores de estado de tareas"
        title="Colores de estado"
      >
        <Settings className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wo-status-colors-title"
            className="relative w-full max-w-md overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-xl sm:rounded-xl sm:border-b"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <h2
                id="wo-status-colors-title"
                className="text-base font-semibold text-zinc-900"
              >
                Colores de estado
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="tap-target rounded-lg border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-sm text-zinc-600">
                Afecta el tablero de tareas, el detalle y los indicadores del calendario.
              </p>
              {WORK_ORDER_STATUS_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-zinc-800">
                    {WORK_ORDER_STATUS_LABELS[key]}
                  </span>
                  <input
                    type="color"
                    value={draft[key]}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="h-9 w-14 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
                  />
                </label>
              ))}
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-4 py-3">
              <button
                type="button"
                onClick={resetDefaults}
                disabled={saving}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Restaurar
              </button>
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
