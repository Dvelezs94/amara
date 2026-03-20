"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SelectOption = { id: string; name: string; sublabel?: string };

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "No se repite" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export function CreateMaintenanceEventForm({
  assets,
  users,
  checklistTemplates,
}: {
  assets: SelectOption[];
  users: SelectOption[];
  checklistTemplates: SelectOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [frequency, setFrequency] = useState<string>("none");
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    const d = new Date().getDay();
    return [d];
  });
  const [until, setUntil] = useState("");
  const [assetId, setAssetId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [checklistTemplateId, setChecklistTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showInterval = frequency !== "none";
  const showWeekdayPick =
    frequency === "weekly" && interval === 1;

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate,
          frequency,
          interval: showInterval ? interval : 1,
          ...(bodyWeekdays ? { weekdays: bodyWeekdays } : {}),
          until: until.trim() || null,
          assetId: assetId || null,
          assigneeId: assigneeId || null,
          checklistTemplateId: checklistTemplateId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error al guardar");
        return;
      }
      setName("");
      setUntil("");
      setChecklistTemplateId("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">
        Nuevo evento de mantenimiento
      </h2>
      <p className="text-xs text-zinc-500">
        Elige fecha de inicio y con qué frecuencia se repite (estilo calendario).
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">Título</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Ej. Lubricación mensual"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">
            Empieza el
          </label>
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
            {FREQUENCY_OPTIONS.map((o) => (
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
                : frequency === "monthly"
                  ? "N meses"
                  : "N años"}
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={interval}
            onChange={(e) =>
              setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            className="w-full max-w-[120px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {frequency === "weekly" && interval > 1 && (
            <p className="text-xs text-amber-700">
              Con intervalo mayor a 1 semana solo se usa el primer día marcado
              abajo (o el día de la fecha de inicio).
            </p>
          )}
        </div>
      )}

      {showWeekdayPick && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-600">
            Días de la semana
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => (
              <label
                key={w.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-900"
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
        <label className="text-xs font-medium text-zinc-600">
          Termina (opcional)
        </label>
        <input
          type="date"
          value={until}
          min={startDate}
          onChange={(e) => setUntil(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">
            Responsable
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">Checklist</label>
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
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
      >
        {saving ? "Guardando…" : "Crear evento"}
      </button>
    </form>
  );
}
