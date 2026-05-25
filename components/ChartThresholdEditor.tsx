"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  createThreshold,
  resolveThresholdColor,
  type ChartThreshold,
} from "@/lib/chart-thresholds";

export function ChartThresholdEditor({
  thresholds,
  onChange,
  disabled,
  compact,
}: {
  thresholds: ChartThreshold[];
  onChange: (next: ChartThreshold[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  function updateThreshold(
    id: string,
    patch: Partial<Pick<ChartThreshold, "value" | "label" | "color">>
  ) {
    onChange(
      thresholds.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }

  function addThreshold() {
    onChange([...thresholds, createThreshold(0)]);
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 space-y-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-700">Umbrales (líneas de referencia)</p>
        <button
          type="button"
          disabled={disabled}
          onClick={addThreshold}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Añadir
        </button>
      </div>
      {thresholds.length === 0 ? (
        <p className="text-[11px] text-zinc-500 leading-snug">
          Define un valor límite para ver una línea horizontal; los puntos por encima se marcan en
          rojo.
        </p>
      ) : (
        <ul className="space-y-2">
          {thresholds.map((t) => {
            const lineColor = resolveThresholdColor(t);
            return (
            <li
              key={t.id}
              className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-white p-2"
            >
              <div className="shrink-0">
                <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Color</label>
                <input
                  type="color"
                  disabled={disabled}
                  value={lineColor}
                  onChange={(e) => updateThreshold(t.id, { color: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 disabled:opacity-50"
                  aria-label="Color del umbral"
                />
              </div>
              <div className="min-w-[5rem] flex-1">
                <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">Valor</label>
                <input
                  type="number"
                  step="any"
                  disabled={disabled}
                  value={Number.isFinite(t.value) ? t.value : ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    updateThreshold(t.id, { value: Number.isFinite(n) ? n : 0 });
                  }}
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                />
              </div>
              <div className="min-w-[6rem] flex-[2]">
                <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                  Etiqueta (opcional)
                </label>
                <input
                  type="text"
                  disabled={disabled}
                  value={t.label ?? ""}
                  onChange={(e) => updateThreshold(t.id, { label: e.target.value })}
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                />
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(thresholds.filter((x) => x.id !== t.id))}
                className="mb-0.5 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label="Quitar umbral"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
