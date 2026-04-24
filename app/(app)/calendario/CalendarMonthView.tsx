"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCreateEventModal } from "./CalendarCreateEventModal";
import {
  expandOccurrencesInRange,
  formatRecurrenceLabel,
  parseRecurrence,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";

export type CalendarSchedulePayload = {
  id: string;
  name: string;
  recurrence: string;
  color?: string | null;
  /** Para registros antiguos sin JSON en recurrence */
  nextRunAt: string | null;
};

const WEEK_HEADER = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Lunes = 0 … Domingo = 6 */
function mondayBasedIndex(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

function startOfCalendarMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function endOfCalendarMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export type CalendarCell = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: { id: string; name: string; recurrence: string; color?: string | null }[];
};

function buildMonthCells(
  cellYear: number,
  cellMonth: number,
  schedules: CalendarSchedulePayload[],
  todayRef: Date = new Date()
): CalendarCell[] {
  const mStart = startOfCalendarMonth(cellYear, cellMonth);
  const monthEnd = endOfCalendarMonth(cellYear, cellMonth);
  const gridStart = new Date(mStart);
  const lead = mondayBasedIndex(mStart);
  gridStart.setDate(gridStart.getDate() - lead);
  const gridEnd = new Date(monthEnd);
  const trail = 6 - mondayBasedIndex(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + trail);

  const map = new Map<
    string,
    { id: string; name: string; recurrence: string; color?: string | null }[]
  >();

  for (const s of schedules) {
    let rule = parseRecurrence(s.recurrence);
    if (!rule && s.nextRunAt) {
      const t = new Date(s.nextRunAt);
      if (!Number.isNaN(t.getTime())) {
        rule = {
          frequency: "none",
          interval: 1,
          anchorDate: toYmdLocal(t),
        };
      }
    }
    if (!rule) continue;
    const dates = expandOccurrencesInRange(rule, gridStart, gridEnd);
    for (const d of dates) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      if (!list.some((x) => x.id === s.id)) {
        list.push({
          id: s.id,
          name: s.name,
          recurrence: s.recurrence,
          color: s.color ?? "#02257D",
        });
        map.set(key, list);
      }
    }
  }

  const cells: CalendarCell[] = [];
  const todayY = todayRef.getFullYear();
  const todayM = todayRef.getMonth();
  const todayD = todayRef.getDate();

  const walk = new Date(gridStart);
  while (walk <= gridEnd) {
    const cur = new Date(walk);
    const inMonth = cur.getMonth() === cellMonth;
    const isToday =
      cur.getFullYear() === todayY &&
      cur.getMonth() === todayM &&
      cur.getDate() === todayD;
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    cells.push({
      date: new Date(cur),
      inMonth,
      isToday,
      events: map.get(key) ?? [],
    });
    walk.setDate(walk.getDate() + 1);
  }

  return cells;
}

type YearAuditRow = {
  ymd: string;
  date: Date;
  ev: { id: string; name: string; recurrence: string; color?: string | null };
};

const YEAR_AUDIT_PAGE_SIZE = 150;
const LINKED_WO_PAGE_SIZE = 15;

function buildYearAuditRows(
  cellYear: number,
  schedules: CalendarSchedulePayload[]
): YearAuditRow[] {
  const rangeStart = new Date(cellYear, 0, 1);
  const rangeEnd = new Date(cellYear, 11, 31);
  const map = new Map<
    string,
    { id: string; name: string; recurrence: string; color?: string | null }[]
  >();

  for (const s of schedules) {
    let rule = parseRecurrence(s.recurrence);
    if (!rule && s.nextRunAt) {
      const t = new Date(s.nextRunAt);
      if (!Number.isNaN(t.getTime())) {
        rule = {
          frequency: "none",
          interval: 1,
          anchorDate: toYmdLocal(t),
        };
      }
    }
    if (!rule) continue;
    const dates = expandOccurrencesInRange(rule, rangeStart, rangeEnd);
    for (const d of dates) {
      if (d.getFullYear() !== cellYear) continue;
      const key = toYmdLocal(d);
      const list = map.get(key) ?? [];
      if (!list.some((x) => x.id === s.id)) {
        list.push({
          id: s.id,
          name: s.name,
          recurrence: s.recurrence,
          color: s.color ?? "#02257D",
        });
        map.set(key, list);
      }
    }
  }

  const keys = Array.from(map.keys()).sort();
  const rows: YearAuditRow[] = [];
  for (const ymd of keys) {
    const events = map.get(ymd) ?? [];
    const [y, m, day] = ymd.split("-").map(Number);
    const date = new Date(y!, m! - 1, day!);
    for (const ev of events) {
      rows.push({ ymd, date, ev });
    }
  }
  return rows;
}

export function CalendarMonthView({
  schedules,
  assets,
  users,
  checklistTemplates,
}: {
  schedules: CalendarSchedulePayload[];
  assets: { id: string; name: string; sublabel?: string }[];
  users: { id: string; name: string }[];
  checklistTemplates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"year" | "month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [yearAuditPage, setYearAuditPage] = useState(0);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = startOfCalendarMonth(year, month);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    name: string;
    recurrence: string;
    color?: string | null;
    dateLabel: string;
    dateYmd: string;
  } | null>(null);
  const [creatingWorkOrder, setCreatingWorkOrder] = useState(false);
  const [createWorkOrderError, setCreateWorkOrderError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [userOptions, setUserOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingUserOptions, setLoadingUserOptions] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [assigneePromptOpen, setAssigneePromptOpen] = useState(false);
  const [linkedWorkOrders, setLinkedWorkOrders] = useState<
    { id: string; folio: number | null; title: string; status: string; createdAt: string | Date }[]
  >([]);
  const [linkedWorkOrdersHasMore, setLinkedWorkOrdersHasMore] = useState(false);
  const [loadingLinkedWorkOrders, setLoadingLinkedWorkOrders] = useState(false);
  const [loadingMoreLinkedWorkOrders, setLoadingMoreLinkedWorkOrders] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedEvent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) {
      setLinkedWorkOrders([]);
      setLinkedWorkOrdersHasMore(false);
      setLoadingLinkedWorkOrders(false);
      setLoadingMoreLinkedWorkOrders(false);
      setSelectedAssigneeId("");
      setAssigneePromptOpen(false);
      return;
    }
    let cancelled = false;
    setLoadingLinkedWorkOrders(true);
    fetch(
      `/api/maintenance-schedules/${selectedEvent.id}/work-orders?limit=${LINKED_WO_PAGE_SIZE}&offset=0`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setLinkedWorkOrders(items);
        setLinkedWorkOrdersHasMore(Boolean(data?.hasMore));
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedWorkOrders([]);
        setLinkedWorkOrdersHasMore(false);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingLinkedWorkOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) {
      setUserOptions([]);
      setLoadingUserOptions(false);
      return;
    }
    let cancelled = false;
    setLoadingUserOptions(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const users = Array.isArray(data) ? data : [];
        setUserOptions(users);
      })
      .catch(() => {
        if (cancelled) return;
        setUserOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingUserOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEvent]);

  function statusLabel(status: string) {
    if (status === "pending") return "Pendiente";
    if (status === "in_progress") return "En progreso";
    if (status === "completed") return "Completada";
    if (status === "cancelled") return "Cancelada";
    return status;
  }

  function statusBadgeClass(status: string) {
    if (status === "pending") return "bg-amber-100 text-amber-800";
    if (status === "in_progress") return "bg-blue-100 text-blue-800";
    if (status === "completed") return "bg-emerald-100 text-emerald-800";
    if (status === "cancelled") return "bg-zinc-100 text-zinc-600";
    return "bg-zinc-100 text-zinc-700";
  }

  function formatOpenedAt(value: string | Date) {
    return new Date(value).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const dayEvents = useMemo(
    () => buildMonthCells(year, month, schedules, new Date()),
    [schedules, year, month]
  );

  const yearForView = currentDate.getFullYear();
  const yearMiniMonths = useMemo(() => {
    if (viewMode !== "year") return [] as CalendarCell[][];
    const now = new Date();
    const months: CalendarCell[][] = [];
    for (let m = 0; m < 12; m++) {
      months.push(buildMonthCells(yearForView, m, schedules, now));
    }
    return months;
  }, [schedules, yearForView, viewMode]);

  const yearAuditRows = useMemo(
    () => (viewMode === "year" ? buildYearAuditRows(yearForView, schedules) : []),
    [viewMode, yearForView, schedules]
  );

  useEffect(() => {
    setYearAuditPage(0);
  }, [viewMode, yearForView]);

  useEffect(() => {
    // Collapse per-day expansions when period/view changes.
    setExpandedCells({});
  }, [viewMode, year, month, currentDate]);

  const yearAuditPageCount = Math.max(
    1,
    Math.ceil(yearAuditRows.length / YEAR_AUDIT_PAGE_SIZE)
  );
  const yearAuditSlice = useMemo(() => {
    const start = yearAuditPage * YEAR_AUDIT_PAGE_SIZE;
    return yearAuditRows.slice(start, start + YEAR_AUDIT_PAGE_SIZE);
  }, [yearAuditRows, yearAuditPage]);

  function goToToday() {
    setCurrentDate(new Date());
  }

  function prevPeriod() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "year") next.setFullYear(next.getFullYear() - 1);
      else if (viewMode === "month") next.setMonth(next.getMonth() - 1);
      else if (viewMode === "week") next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 1);
      return next;
    });
  }

  function nextPeriod() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "year") next.setFullYear(next.getFullYear() + 1);
      else if (viewMode === "month") next.setMonth(next.getMonth() + 1);
      else if (viewMode === "week") next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
      return next;
    });
  }

  const weekStart = useMemo(() => {
    const base = new Date(currentDate);
    const shift = mondayBasedIndex(base);
    base.setDate(base.getDate() - shift);
    return base;
  }, [currentDate]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const title =
    viewMode === "year"
      ? String(yearForView)
      : viewMode === "day"
        ? currentDate.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : viewMode === "week"
          ? `${weekStart.toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
            })} - ${weekEnd.toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          : monthStart.toLocaleDateString("es-MX", {
              month: "long",
              year: "numeric",
            });

  const periodNavAriaPrev =
    viewMode === "year"
      ? "Año anterior"
      : viewMode === "month"
        ? "Mes anterior"
        : viewMode === "week"
          ? "Semana anterior"
          : "Día anterior";
  const periodNavAriaNext =
    viewMode === "year"
      ? "Año siguiente"
      : viewMode === "month"
        ? "Mes siguiente"
        : viewMode === "week"
          ? "Semana siguiente"
          : "Día siguiente";

  const visibleCells = useMemo(() => {
    if (viewMode === "year") return [];
    if (viewMode === "month") return dayEvents;
    if (viewMode === "week") {
      const startYmd = toYmdLocal(weekStart);
      const endYmd = toYmdLocal(weekEnd);
      return dayEvents.filter((cell) => {
        const ymd = toYmdLocal(cell.date);
        return ymd >= startYmd && ymd <= endYmd;
      });
    }
    const dayYmd = toYmdLocal(currentDate);
    return dayEvents.filter((cell) => toYmdLocal(cell.date) === dayYmd);
  }, [viewMode, dayEvents, weekStart, weekEnd, currentDate]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200 ${
        viewMode === "year" ? "bg-surface" : "bg-white"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold uppercase tracking-wide text-zinc-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={prevPeriod}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              aria-label={periodNavAriaPrev}
            >
              ←
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={nextPeriod}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              aria-label={periodNavAriaNext}
            >
              →
            </button>
          </div>
          <div className="inline-flex rounded-sm border border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 ${viewMode === "month" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 ${viewMode === "week" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 ${viewMode === "day" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={`px-3 py-1 ${viewMode === "year" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Año
            </button>
          </div>
        </div>
        {viewMode !== "day" && viewMode !== "year" && (
          <div className={`grid border-b border-zinc-200 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 ${viewMode === "week" ? "grid-cols-7" : "grid-cols-7"}`}>
            {WEEK_HEADER.map((w) => (
              <div key={w} className="border-r border-zinc-200 py-2 last:border-r-0">
                {w}
              </div>
            ))}
          </div>
        )}
        {viewMode === "year" ? (
          <div className="border-t border-zinc-200 bg-surface">
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
              {yearMiniMonths.map((cells, monthIdx) => (
                <div
                  key={monthIdx}
                  className="cal-year-month-card overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 shadow-sm"
                >
                  <p className="cal-year-month-title border-b border-zinc-200 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-800">
                    {new Date(yearForView, monthIdx, 1).toLocaleDateString("es-MX", {
                      month: "long",
                    })}
                  </p>
                  <div className="cal-year-dow-row grid grid-cols-7 border-b border-zinc-200 text-center text-[8px] font-semibold uppercase tracking-tight text-zinc-600">
                    {WEEK_HEADER.map((w) => (
                      <div key={w} className="border-r border-zinc-200 py-0.5 last:border-r-0">
                        {w.slice(0, 2)}
                      </div>
                    ))}
                  </div>
                  <div className="cal-year-grid-bg grid grid-cols-7">
                    {cells.map((cell, i) => {
                      const dateYmd = toYmdLocal(cell.date);
                      return (
                        <div
                          key={i}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setCurrentDate(new Date(cell.date));
                            setViewMode("month");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCurrentDate(new Date(cell.date));
                              setViewMode("month");
                            }
                          }}
                          className={`min-h-[46px] cursor-pointer border-r border-b border-zinc-200 px-0.5 py-0.5 text-left align-top transition-colors ${
                            cell.inMonth ? "cal-year-cell-in" : "cal-year-cell-out"
                          } ${cell.isToday ? "ring-1 ring-inset ring-accent-500" : ""}`}
                        >
                          <div className="cal-year-daynum text-[9px] font-semibold">
                            {cell.date.getDate()}
                          </div>
                          {cell.events.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                              {cell.events.slice(0, 4).map((ev) => (
                                <button
                                  key={`${ev.id}-${i}`}
                                  type="button"
                                  title={ev.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent({
                                      id: ev.id,
                                      name: ev.name,
                                      recurrence: ev.recurrence,
                                      color: ev.color,
                                      dateLabel: cell.date.toLocaleDateString("es-MX", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      }),
                                      dateYmd,
                                    });
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: ev.color ?? "#02257D" }}
                                  aria-label={ev.name}
                                />
                              ))}
                              {cell.events.length > 4 ? (
                                <span className="text-[8px] font-semibold leading-none text-zinc-500">
                                  +{cell.events.length - 4}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="cal-year-audit-strip border-t border-zinc-200 px-3 py-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                Registro anual
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Listado cronológico de todas las ocurrencias programadas en {yearForView}. Pulse un día
                en la cuadrícula para abrir la vista mes.
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-800">
                Total: {yearAuditRows.length} ocurrencia
                {yearAuditRows.length === 1 ? "" : "s"}
              </p>
              {yearAuditRows.length === 0 ? (
                <p className="cal-year-empty mt-3 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-4 text-center text-sm text-zinc-600">
                  Sin ocurrencias en este año.
                </p>
              ) : (
                <>
                  <div className="cal-year-table-scroll mt-3 max-h-[min(28rem,55vh)] overflow-auto rounded-md border border-zinc-200 bg-zinc-100 shadow-sm">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                      <thead className="cal-year-thead sticky top-0 z-[1] border-b border-zinc-200 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2.5">Fecha</th>
                          <th className="px-3 py-2.5">Evento</th>
                          <th className="px-3 py-2.5">Frecuencia</th>
                        </tr>
                      </thead>
                      <tbody className="cal-year-tbody bg-zinc-100 text-zinc-900">
                        {yearAuditSlice.map((row) => (
                          <tr
                            key={`${row.ymd}-${row.ev.id}`}
                            className="cal-year-tr border-b border-zinc-200 last:border-b-0"
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-zinc-700 tabular-nums">
                              {row.date.toLocaleDateString("es-MX", {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEvent({
                                    id: row.ev.id,
                                    name: row.ev.name,
                                    recurrence: row.ev.recurrence,
                                    color: row.ev.color,
                                    dateLabel: row.date.toLocaleDateString("es-MX", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    }),
                                    dateYmd: row.ymd,
                                  })
                                }
                                className="max-w-[280px] truncate text-left font-semibold text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
                              >
                                {row.ev.name}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-zinc-600 leading-snug">
                              {formatRecurrenceLabel(row.ev.recurrence)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {yearAuditPageCount > 1 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-700">
                      <span>
                        Página {yearAuditPage + 1} de {yearAuditPageCount} (
                        {yearAuditSlice.length ? yearAuditPage * YEAR_AUDIT_PAGE_SIZE + 1 : 0}
                        {"–"}
                        {yearAuditPage * YEAR_AUDIT_PAGE_SIZE + yearAuditSlice.length} de{" "}
                        {yearAuditRows.length})
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={yearAuditPage <= 0}
                          onClick={() => setYearAuditPage((p) => Math.max(0, p - 1))}
                          className="cal-year-page-btn rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-1 font-semibold uppercase tracking-wide text-zinc-800 disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={yearAuditPage >= yearAuditPageCount - 1}
                          onClick={() =>
                            setYearAuditPage((p) => Math.min(yearAuditPageCount - 1, p + 1))
                          }
                          className="cal-year-page-btn rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-1 font-semibold uppercase tracking-wide text-zinc-800 disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={viewMode === "day" ? "grid grid-cols-1" : "grid grid-cols-7"}>
            {visibleCells.map((cell, i) => {
              const dateYmd = toYmdLocal(cell.date);
              const isExpanded = viewMode === "day" || expandedCells[dateYmd] === true;
              const visibleEvents = isExpanded ? cell.events : cell.events.slice(0, 2);
              const hiddenCount = Math.max(0, cell.events.length - visibleEvents.length);
              return (
                <div
                  key={i}
                  onClick={() => {
                    const ymd = toYmdLocal(cell.date);
                    setCurrentDate(new Date(cell.date));
                    setCreateModalDate(ymd);
                    setCreateModalOpen(true);
                  }}
                  className={`min-h-[108px] border-r border-b border-zinc-200 px-2 py-1 text-left align-top transition-colors ${
                    cell.inMonth ? "bg-surface" : "bg-zinc-50/50"
                  } ${cell.isToday ? "ring-1 ring-inset ring-accent-500" : ""}`}
                >
                  <div
                    className={`mb-1 text-xs font-medium ${
                      cell.inMonth ? "text-zinc-800" : "text-zinc-500"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {visibleEvents.map((ev) => (
                      <button
                        key={`${ev.id}-${i}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent({
                            id: ev.id,
                            name: ev.name,
                            recurrence: ev.recurrence,
                            color: ev.color,
                            dateLabel: cell.date.toLocaleDateString("es-MX", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }),
                            dateYmd,
                          });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white"
                        style={{ backgroundColor: ev.color ?? "#02257D" }}
                        title={ev.name}
                      >
                        {ev.name}
                      </button>
                    ))}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCells((prev) => ({ ...prev, [dateYmd]: true }));
                        }}
                        className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        +{hiddenCount} más
                      </button>
                    ) : cell.events.length > 2 && viewMode !== "day" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCells((prev) => ({ ...prev, [dateYmd]: false }));
                        }}
                        className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        Ver menos
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setSelectedEvent(null);
            setCreateWorkOrderError(null);
            setActionsOpen(false);
            setAssigneePromptOpen(false);
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="truncate pr-3 text-sm font-semibold text-zinc-900">
                {selectedEvent.name}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                  setCreateWorkOrderError(null);
                  setActionsOpen(false);
                  setAssigneePromptOpen(false);
                }}
                className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Cerrar
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {formatRecurrenceLabel(selectedEvent.recurrence)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{selectedEvent.dateLabel}</p>
              {createWorkOrderError ? (
                <p className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
                  {createWorkOrderError}
                </p>
              ) : null}
              <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                Tareas asociadas
              </p>
              {loadingLinkedWorkOrders ? (
                <p className="mt-1 text-xs text-zinc-600">Cargando...</p>
              ) : linkedWorkOrders.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-600">Sin tareas asociadas.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {linkedWorkOrders.map((wo) => (
                    <li
                      key={wo.id}
                      className="rounded-md border border-zinc-200 bg-white px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <Link
                          href={`/tareas/${wo.id}`}
                          className="line-clamp-2 text-[#F14C03] hover:underline"
                          onClick={() => setSelectedEvent(null)}
                        >
                          {wo.folio != null ? `Folio ${wo.folio} · ` : ""}
                          {wo.title}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                            wo.status
                          )}`}
                        >
                          {statusLabel(wo.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Abierta el {formatOpenedAt(wo.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {linkedWorkOrdersHasMore ? (
                <button
                  type="button"
                  disabled={loadingMoreLinkedWorkOrders || !selectedEvent}
                  onClick={async () => {
                    if (!selectedEvent || loadingMoreLinkedWorkOrders) return;
                    setLoadingMoreLinkedWorkOrders(true);
                    try {
                      const offset = linkedWorkOrders.length;
                      const res = await fetch(
                        `/api/maintenance-schedules/${selectedEvent.id}/work-orders?limit=${LINKED_WO_PAGE_SIZE}&offset=${offset}`
                      );
                      const data = await res.json().catch(() => ({}));
                      const items = Array.isArray(data?.items) ? data.items : [];
                      setLinkedWorkOrders((prev) => [...prev, ...items]);
                      setLinkedWorkOrdersHasMore(Boolean(data?.hasMore));
                    } finally {
                      setLoadingMoreLinkedWorkOrders(false);
                    }
                  }}
                  className="mt-2 rounded-sm border border-zinc-200 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {loadingMoreLinkedWorkOrders ? "Cargando…" : "Cargar más"}
                </button>
              ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={creatingWorkOrder}
                onClick={() => {
                  setCreateWorkOrderError(null);
                  setAssigneePromptOpen(true);
                }}
                className="rounded-sm bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {creatingWorkOrder ? "Creando..." : "Crear tarea"}
              </button>
              <button
                type="button"
                className="rounded-sm border border-zinc-300 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-zinc-700 hover:bg-zinc-100"
                onClick={() => setActionsOpen((prev) => !prev)}
              >
                Acciones
              </button>
              {actionsOpen ? (
                <div className="min-w-[220px] rounded-sm border border-zinc-200 bg-white p-1 text-xs shadow-sm">
                  <button
                    type="button"
                    onClick={async () => {
                      const firstConfirm = window.confirm(
                        `Eliminar solo la ocurrencia del ${selectedEvent.dateLabel}?`
                      );
                      if (!firstConfirm) return;
                      const res = await fetch(
                        `/api/maintenance-schedules/${selectedEvent.id}?scope=single&date=${encodeURIComponent(
                          selectedEvent.dateYmd
                        )}`,
                        { method: "DELETE" }
                      );
                      setSelectedEvent(null);
                      setActionsOpen(false);
                      if (res.ok) router.refresh();
                    }}
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-zinc-800 hover:bg-zinc-100"
                  >
                    Eliminar evento
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const firstConfirm = window.confirm(
                        "Eliminar toda la serie de este evento? Esta acción no se puede deshacer."
                      );
                      if (!firstConfirm) return;
                      const secondConfirm = window.confirm(
                        "Confirmación final: se eliminará toda la serie completa. ¿Deseas continuar?"
                      );
                      if (!secondConfirm) return;
                      const res = await fetch(
                        `/api/maintenance-schedules/${selectedEvent.id}?scope=all`,
                        { method: "DELETE" }
                      );
                      setSelectedEvent(null);
                      setActionsOpen(false);
                      if (res.ok) router.refresh();
                    }}
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-red-600 hover:bg-red-50"
                  >
                    Eliminar serie
                  </button>
                </div>
              ) : null}
              </div>
              {assigneePromptOpen ? (
                <div className="mt-2 rounded-sm border border-zinc-300 bg-zinc-50 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Asignar responsable
                </p>
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  disabled={loadingUserOptions || creatingWorkOrder}
                  className="w-full rounded-sm border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800"
                >
                  <option value="">
                    {loadingUserOptions ? "Cargando usuarios..." : "Selecciona un responsable"}
                  </option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-sm bg-primary-600 px-2 py-1 text-[11px] font-semibold uppercase text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={creatingWorkOrder || !selectedAssigneeId}
                    onClick={async () => {
                      if (!selectedEvent || !selectedAssigneeId) return;
                      setCreateWorkOrderError(null);
                      setCreatingWorkOrder(true);
                      try {
                        const res = await fetch(
                          `/api/maintenance-schedules/${selectedEvent.id}/create-work-order`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              dateYmd: selectedEvent.dateYmd,
                              assigneeId: selectedAssigneeId,
                            }),
                          }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setCreateWorkOrderError(
                            typeof data.error === "string"
                              ? data.error
                              : "No se pudo crear la tarea"
                          );
                          return;
                        }
                        setSelectedEvent(null);
                        setAssigneePromptOpen(false);
                        router.push(`/tareas/${data.id}`);
                        router.refresh();
                      } finally {
                        setCreatingWorkOrder(false);
                      }
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-zinc-300 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-700 hover:bg-zinc-100"
                    onClick={() => setAssigneePromptOpen(false)}
                    disabled={creatingWorkOrder}
                  >
                    Cancelar
                  </button>
                </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <CalendarCreateEventModal
        assets={assets}
        users={users}
        checklistTemplates={checklistTemplates}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        initialStartDate={createModalDate}
        hideTrigger
      />
    </div>
  );
}
