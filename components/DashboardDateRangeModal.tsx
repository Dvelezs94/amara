"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  clampRangeOrder,
  startOfLocalDayFromYmd,
} from "@/lib/dashboard-date-range";
import {
  DASHBOARD_QUICK_PRESETS,
  matchQuickPreset,
  rangeForQuickPreset,
  type DashboardQuickPreset,
} from "@/lib/dashboard-quick-presets";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(y: number, m0: number, day: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Monday = 0 … Sunday = 6 */
function mondayIndexFromFirstOfMonth(year: number, month0: number): number {
  const first = new Date(year, month0, 1);
  return (first.getDay() + 6) % 7;
}

function addMonths(year: number, month0: number, delta: number): { y: number; m: number } {
  const d = new Date(year, month0 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function formatMonthTitle(year: number, month0: number, locale = "es-MX") {
  return new Date(year, month0, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatRangeFooter(from: string, to: string, locale = "es-MX") {
  const a = startOfLocalDayFromYmd(from);
  const b = startOfLocalDayFromYmd(to);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${a.toLocaleDateString(locale, opts)} — ${b.toLocaleDateString(locale, opts)}`;
}

function monthCells(year: number, month0: number): (number | null)[] {
  const lead = mondayIndexFromFirstOfMonth(year, month0);
  const n = daysInMonth(year, month0);
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function cellKind(
  ymd: string,
  draftFrom: string,
  draftTo: string
): "start" | "end" | "middle" | "single" | "outside" {
  if (ymd < draftFrom || ymd > draftTo) return "outside";
  if (draftFrom === draftTo) return ymd === draftFrom ? "single" : "outside";
  if (ymd === draftFrom) return "start";
  if (ymd === draftTo) return "end";
  return "middle";
}

function MonthGrid({
  title,
  year,
  month0,
  draftFrom,
  draftTo,
  onDayClick,
}: {
  title: string;
  year: number;
  month0: number;
  draftFrom: string;
  draftTo: string;
  onDayClick: (ymd: string) => void;
}) {
  const cells = useMemo(() => monthCells(year, month0), [year, month0]);
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="min-w-0">
      <p className="mb-3 text-center text-sm font-semibold capitalize text-zinc-800">{title}</p>
      <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {weekDays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg bg-zinc-200 p-px">
        {cells.map((day, i) => {
          if (day == null) {
            return <div key={`e-${i}`} className="h-9 bg-white" />;
          }
          const ymd = toYmd(year, month0, day);
          const kind = cellKind(ymd, draftFrom, draftTo);
          const inRange = kind !== "outside";
          const emphasis = kind === "start" || kind === "end" || kind === "single";
          const cellBg = inRange ? "bg-primary-50" : "bg-white";
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onDayClick(ymd)}
              className={`flex h-9 w-full items-center justify-center text-xs font-medium transition-colors ${cellBg} ${
                inRange ? "text-zinc-900" : "text-zinc-300"
              } hover:bg-primary-100/80`}
            >
              <span
                className={
                  emphasis
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm"
                    : "flex h-8 w-8 items-center justify-center rounded-full"
                }
              >
                {day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: { from: string; to: string };
  onApply: (next: { from: string; to: string }) => void;
};

export function DashboardDateRangeModal({
  open,
  onOpenChange,
  value,
  onApply,
}: Props) {
  const titleId = useId();
  const [draft, setDraft] = useState(value);
  const [viewY, setViewY] = useState(() => {
    const [y, m] = value.from.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [pickStage, setPickStage] = useState<"idle" | "end">("idle");
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<DashboardQuickPreset | "custom">("custom");

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    const [y, m] = value.from.split("-").map(Number);
    setViewY({ y, m: m - 1 });
    setPickStage("idle");
    setPickStart(null);
    setActivePreset(matchQuickPreset(value));
  }, [open, value]);

  useEffect(() => {
    if (!open || pickStage === "end") return;
    setActivePreset(matchQuickPreset(draft));
  }, [draft.from, draft.to, open, pickStage]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const bumpView = useCallback((delta: number) => {
    setViewY((v) => {
      const n = addMonths(v.y, v.m, delta);
      return { y: n.y, m: n.m };
    });
  }, []);

  const rightView = useMemo(() => addMonths(viewY.y, viewY.m, 1), [viewY]);

  const onDayClick = useCallback(
    (ymd: string) => {
      setActivePreset("custom");
      if (pickStage === "idle") {
        setPickStart(ymd);
        setPickStage("end");
        setDraft(clampRangeOrder(ymd, ymd));
        return;
      }
      if (pickStart) {
        setDraft(clampRangeOrder(pickStart, ymd));
        setPickStage("idle");
        setPickStart(null);
      }
    },
    [pickStage, pickStart]
  );

  const onPreset = (id: DashboardQuickPreset) => {
    const next = rangeForQuickPreset(id);
    setDraft(next);
    setActivePreset(id);
    setPickStage("idle");
    setPickStart(null);
    const [y, m] = next.from.split("-").map(Number);
    setViewY({ y, m: m - 1 });
  };

  const apply = () => {
    onApply(clampRangeOrder(draft.from, draft.to));
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl md:my-0 md:max-h-[min(90vh,720px)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-zinc-900">
            Rango de fechas
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar modal"
            className="rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            className="flex shrink-0 flex-col border-b border-zinc-100 md:w-52 md:border-b-0 md:border-r"
            aria-label="Rangos rápidos"
          >
            {DASHBOARD_QUICK_PRESETS.map(({ id, label }) => {
              const selected = activePreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPreset(id)}
                  className={`border-l-4 py-2.5 pl-4 pr-3 text-left text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary-600 bg-primary-50 text-primary-900"
                      : "border-transparent text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActivePreset("custom")}
              className={`border-l-4 py-2.5 pl-4 pr-3 text-left text-sm font-medium transition-colors ${
                activePreset === "custom"
                  ? "border-primary-600 bg-primary-50 text-primary-900"
                  : "border-transparent text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Personalizado
            </button>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
            <div className="mb-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => bumpView(-1)}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50"
                aria-label="Meses anteriores"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => bumpView(1)}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50"
                aria-label="Meses siguientes"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
              <MonthGrid
                title={formatMonthTitle(viewY.y, viewY.m)}
                year={viewY.y}
                month0={viewY.m}
                draftFrom={draft.from}
                draftTo={draft.to}
                onDayClick={onDayClick}
              />
              <MonthGrid
                title={formatMonthTitle(rightView.y, rightView.m)}
                year={rightView.y}
                month0={rightView.m}
                draftFrom={draft.from}
                draftTo={draft.to}
                onDayClick={onDayClick}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <input
              type="date"
              value={draft.from}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setActivePreset("custom");
                setDraft((d) => clampRangeOrder(v, d.to));
                setPickStage("idle");
                setPickStart(null);
              }}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="date"
              value={draft.to}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setActivePreset("custom");
                setDraft((d) => clampRangeOrder(d.from, v));
                setPickStage("idle");
                setPickStart(null);
              }}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900"
            />
            <span className="hidden text-xs text-zinc-500 md:inline">
              {formatRangeFooter(draft.from, draft.to)}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function formatDashboardRangeTrigger(
  range: { from: string; to: string },
  locale = "es-MX"
) {
  return formatRangeFooter(range.from, range.to, locale);
}
