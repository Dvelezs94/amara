"use client";

import { useMemo, useState } from "react";
import {
  expandOccurrencesInRange,
  parseRecurrence,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";

export type CalendarSchedulePayload = {
  id: string;
  name: string;
  recurrence: string;
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

export function CalendarMonthView({
  schedules,
}: {
  schedules: CalendarSchedulePayload[];
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const { year, month } = cursor;
  const monthStart = startOfCalendarMonth(year, month);

  const dayEvents = useMemo(() => {
    const mStart = startOfCalendarMonth(year, month);
    const monthEnd = endOfCalendarMonth(year, month);
    const gridStart = new Date(mStart);
    const lead = mondayBasedIndex(mStart);
    gridStart.setDate(gridStart.getDate() - lead);
    const gridEnd = new Date(monthEnd);
    const trail = 6 - mondayBasedIndex(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + trail);

    const map = new Map<
      string,
      { id: string; name: string; recurrence: string }[]
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
          list.push({ id: s.id, name: s.name, recurrence: s.recurrence });
        }
        map.set(key, list);
      }
    }

    const cells: {
      date: Date;
      inMonth: boolean;
      isToday: boolean;
      events: { id: string; name: string; recurrence: string }[];
    }[] = [];

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    const walk = new Date(gridStart);
    while (walk <= gridEnd) {
      const cur = new Date(walk);
      const inMonth = cur.getMonth() === month;
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
  }, [schedules, year, month]);

  function prevMonth() {
    setCursor((c) => {
      const m = c.month - 1;
      if (m < 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: m };
    });
  }

  function nextMonth() {
    setCursor((c) => {
      const m = c.month + 1;
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  }

  const title = monthStart.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold capitalize text-zinc-900">
          {title}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            →
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {WEEK_HEADER.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {dayEvents.map((cell, i) => (
          <div
            key={i}
            className={[
              "min-h-[72px] rounded-lg border p-1 text-left text-xs",
              cell.inMonth
                ? "border-zinc-100 bg-white"
                : "border-transparent bg-zinc-50/50 text-zinc-400",
              cell.isToday ? "ring-1 ring-primary-400" : "",
            ].join(" ")}
          >
            <div
              className={[
                "mb-0.5 text-[11px] font-medium",
                cell.inMonth ? "text-zinc-800" : "text-zinc-400",
              ].join(" ")}
            >
              {cell.date.getDate()}
            </div>
            <div className="flex flex-col gap-0.5">
              {cell.events.slice(0, 2).map((ev) => (
                <span
                  key={`${ev.id}-${i}`}
                  title={ev.name}
                  className="truncate rounded bg-primary-100 px-1 py-0.5 text-[10px] font-medium text-primary-900"
                >
                  {ev.name}
                </span>
              ))}
              {cell.events.length > 2 && (
                <span className="text-[9px] text-zinc-500">
                  +{cell.events.length - 2} más
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
