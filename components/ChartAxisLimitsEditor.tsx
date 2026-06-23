"use client";

import {
  datetimeLocalValueToEpochMs,
  epochMsToDatetimeLocalValue,
  type ChartAxisLimits,
} from "@/lib/chart-axis-limits";
import { APP_TIME_ZONE } from "@/lib/timezone";

function AxisNumberInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="min-w-[5rem] flex-1">
      <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">{label}</label>
      <input
        type="number"
        step="any"
        disabled={disabled}
        value={value != null && Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          const n = Number(raw.replace(",", "."));
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 disabled:bg-zinc-100"
      />
    </div>
  );
}

function AxisDateInput({
  label,
  valueMs,
  disabled,
  onChange,
}: {
  label: string;
  valueMs: number | null;
  disabled: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="min-w-[8.5rem] flex-1">
      <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">{label}</label>
      <input
        type="datetime-local"
        disabled={disabled}
        value={
          valueMs != null && Number.isFinite(valueMs)
            ? epochMsToDatetimeLocalValue(valueMs, APP_TIME_ZONE)
            : ""
        }
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          onChange(datetimeLocalValueToEpochMs(raw, APP_TIME_ZONE));
        }}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 disabled:bg-zinc-100"
      />
    </div>
  );
}

export function ChartAxisLimitsEditor({
  limits,
  onChange,
  disabled,
  compact,
  showXAxis = true,
}: {
  limits: ChartAxisLimits;
  onChange: (next: ChartAxisLimits) => void;
  disabled?: boolean;
  compact?: boolean;
  /** False for categorical X axes (only Y is configurable). */
  showXAxis?: boolean;
}) {
  function patch(p: Partial<ChartAxisLimits>) {
    onChange({ ...limits, ...p });
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3"
      }
    >
      <p className="text-xs font-medium text-zinc-700">Límites de ejes</p>
      <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-1.5 pb-1 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={limits.yAuto}
              disabled={disabled}
              onChange={(e) => patch({ yAuto: e.target.checked })}
              className="rounded border-zinc-400"
            />
            Eje Y automático
          </label>
          <AxisNumberInput
            label="Y mín"
            value={limits.yMin}
            disabled={disabled || limits.yAuto}
            onChange={(yMin) => patch({ yMin })}
          />
          <AxisNumberInput
            label="Y máx"
            value={limits.yMax}
            disabled={disabled || limits.yAuto}
            onChange={(yMax) => patch({ yMax })}
          />
        </div>
        {showXAxis ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-2">
            <label className="flex items-center gap-1.5 pb-1 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={limits.xAuto}
                disabled={disabled}
                onChange={(e) => patch({ xAuto: e.target.checked })}
                className="rounded border-zinc-400"
              />
              Eje X automático
            </label>
            <AxisDateInput
              label="X desde"
              valueMs={limits.xMin}
              disabled={disabled || limits.xAuto}
              onChange={(xMin) => patch({ xMin })}
            />
            <AxisDateInput
              label="X hasta"
              valueMs={limits.xMax}
              disabled={disabled || limits.xAuto}
              onChange={(xMax) => patch({ xMax })}
            />
          </div>
        ) : (
          <p className="border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
            El eje X usa las categorías del gráfico (automático).
          </p>
        )}
      </div>
    </div>
  );
}
