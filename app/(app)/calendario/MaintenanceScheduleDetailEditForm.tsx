"use client";

import {
  parseRecurrence,
  ruleToMaintenanceEditFormState,
} from "@/lib/maintenance-recurrence";
import { useEffect, useMemo, useState } from "react";
import {
  MAINTENANCE_EVENT_COLORS,
  MAINTENANCE_FREQUENCY_OPTIONS,
  MAINTENANCE_WEEKDAYS,
} from "./maintenance-schedule-form-constants";

type SelectOption = { id: string; name: string; sublabel?: string };

export function MaintenanceScheduleDetailEditForm({
  scheduleId,
  recurrenceJson,
  checklistTemplateId: initialChecklistId,
  assetId: initialAssetId,
  color: initialColor,
  assets,
  checklistTemplates,
  fallbackAnchorYmd,
  onSaved,
}: {
  scheduleId: string;
  recurrenceJson: string;
  checklistTemplateId: string | null;
  assetId: string | null;
  color: string | null;
  assets: SelectOption[];
  checklistTemplates: { id: string; name: string }[];
  /** When recurrence JSON is legacy/invalid, anchor new rules to the opened calendar day. */
  fallbackAnchorYmd: string;
  onSaved: (patch: Record<string, unknown>) => void;
}) {
  const rule0 = useMemo(() => parseRecurrence(recurrenceJson), [recurrenceJson]);
  const initialForm = useMemo(() => {
    if (rule0) {
      return ruleToMaintenanceEditFormState(rule0);
    }
    const [y, m, d] = fallbackAnchorYmd.split("-").map(Number);
    const dow = new Date(y!, m! - 1, d!).getDay();
    return {
      frequency: "none",
      interval: 1,
      anchorDate: fallbackAnchorYmd,
      until: "",
      weekdays: [dow],
    };
  }, [rule0, fallbackAnchorYmd]);

  const [startDate, setStartDate] = useState(initialForm.anchorDate);
  const [frequency, setFrequency] = useState(initialForm.frequency);
  const [interval, setInterval] = useState(initialForm.interval);
  const [weekdays, setWeekdays] = useState<number[]>(initialForm.weekdays);
  const [until, setUntil] = useState(initialForm.until);
  const [assetId, setAssetId] = useState(initialAssetId ?? "");
  const [checklistTemplateId, setChecklistTemplateId] = useState(
    initialChecklistId ?? ""
  );
  const [color, setColor] = useState(
    initialColor && /^#[0-9A-F]{6}$/i.test(initialColor)
      ? initialColor.toUpperCase()
      : "#02257D"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStartDate(initialForm.anchorDate);
    setFrequency(initialForm.frequency);
    setInterval(initialForm.interval);
    setWeekdays(initialForm.weekdays);
    setUntil(initialForm.until);
    setAssetId(initialAssetId ?? "");
    setChecklistTemplateId(initialChecklistId ?? "");
    setColor(
      initialColor && /^#[0-9A-F]{6}$/i.test(initialColor)
        ? initialColor.toUpperCase()
        : "#02257D"
    );
  }, [
    scheduleId,
    recurrenceJson,
    initialChecklistId,
    initialAssetId,
    initialColor,
    initialForm.anchorDate,
    initialForm.frequency,
    initialForm.interval,
    initialForm.weekdays,
    initialForm.until,
  ]);

  const effectiveFrequency = useMemo(() => {
    if (frequency === "quarterly" || frequency === "semiannual") return "monthly";
    return frequency;
  }, [frequency]);

  const effectiveInterval = useMemo(() => {
    if (frequency === "quarterly") return 3;
    if (frequency === "semiannual") return 6;
    return interval;
  }, [frequency, interval]);

  const showInterval = effectiveFrequency !== "none";
  const showWeekdayPick = effectiveFrequency === "weekly" && effectiveInterval === 1;

  const bodyWeekdays = useMemo(() => {
    if (!showWeekdayPick) return undefined;
    if (weekdays.length === 0) return undefined;
    return weekdays;
  }, [showWeekdayPick, weekdays]);

  function toggleWeekday(v: number) {
    setWeekdays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort()
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (showWeekdayPick && weekdays.length === 0) {
      setError("Selecciona al menos un día de la semana.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/maintenance-schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency: effectiveFrequency,
          interval: showInterval ? effectiveInterval : 1,
          startDate,
          ...(bodyWeekdays ? { weekdays: bodyWeekdays } : {}),
          until: until.trim() || null,
          assetId: assetId || null,
          checklistTemplateId: checklistTemplateId || null,
          color,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo guardar");
        return;
      }
      onSaved(
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {}
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
      <p className="text-xs font-semibold text-zinc-800">Frecuencia y checklist del evento</p>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">Empieza el (ancla)</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">Frecuencia</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MAINTENANCE_FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showInterval && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">
            Repetir cada{" "}
            {frequency === "daily"
              ? "N días"
              : frequency === "weekly"
                ? "N semanas"
                : effectiveFrequency === "monthly"
                  ? "N meses"
                  : "N años"}
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={effectiveInterval}
            onChange={(e) =>
              setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            disabled={frequency === "quarterly" || frequency === "semiannual"}
            className="ml-4 w-full max-w-[120px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {effectiveFrequency === "weekly" && effectiveInterval > 1 && (
            <p className="text-xs text-amber-700">
              Con intervalo mayor a 1 semana solo se usa el primer día marcado abajo (o el día de la
              fecha de inicio).
            </p>
          )}
        </div>
      )}

      {showWeekdayPick && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-600">Días de la semana</span>
          <div className="flex flex-wrap gap-2">
            {MAINTENANCE_WEEKDAYS.map((w) => (
              <label
                key={w.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-900"
              >
                <input
                  type="checkbox"
                  checked={weekdays.includes(w.value)}
                  onChange={() => toggleWeekday(w.value)}
                  className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                />
                {w.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">Termina (opcional)</label>
        <input
          type="date"
          value={until}
          min={startDate}
          onChange={(e) => setUntil(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">Activo</label>
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Sin activo</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.sublabel ? ` (${a.sublabel})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-600">Color del evento</label>
        <div className="flex flex-wrap items-center gap-2">
          {MAINTENANCE_EVENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 transition ${
                color === c ? "border-zinc-900 ring-1 ring-zinc-300" : "border-white"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Seleccionar color ${c}`}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-1"
            aria-label="Selector de color personalizado"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">Checklist en tareas generadas</label>
        <select
          value={checklistTemplateId}
          onChange={(e) => setChecklistTemplateId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Sin plantilla</option>
          {checklistTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving || (showWeekdayPick && weekdays.length === 0)}
        className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar checklist"}
      </button>
    </form>
  );
}
