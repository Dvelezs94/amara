import {
  clampRangeOrder,
  defaultLast30DaysRange,
  rangesEqual,
  toYmdLocal,
} from "@/lib/dashboard-date-range";

export type DashboardQuickPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_30"
  | "max_span";

export const DASHBOARD_QUICK_PRESETS: {
  id: DashboardQuickPreset;
  label: string;
}[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "this_week", label: "Esta semana" },
  { id: "last_week", label: "Semana pasada" },
  { id: "this_month", label: "Este mes" },
  { id: "last_month", label: "Mes pasado" },
  { id: "this_year", label: "Este año" },
  { id: "last_year", label: "Año pasado" },
  { id: "last_30", label: "Últimos 30 días" },
  { id: "max_span", label: "Todo el período" },
];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday = 0 … Sunday = 6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Widest range allowed by `clampRangeOrder` (ends today). */
export function maxSpanRangeEndingToday(now = new Date()): { from: string; to: string } {
  return clampRangeOrder("1970-01-01", toYmdLocal(startOfLocalDay(now)));
}

export function rangeForQuickPreset(
  id: DashboardQuickPreset,
  now = new Date()
): { from: string; to: string } {
  const t = startOfLocalDay(now);
  const ymd = (d: Date) => toYmdLocal(d);

  switch (id) {
    case "today":
      return clampRangeOrder(ymd(t), ymd(t));
    case "yesterday": {
      const y = new Date(t);
      y.setDate(y.getDate() - 1);
      return clampRangeOrder(ymd(y), ymd(y));
    }
    case "this_week": {
      const mon = new Date(t);
      mon.setDate(mon.getDate() - mondayIndex(t));
      return clampRangeOrder(ymd(mon), ymd(t));
    }
    case "last_week": {
      const thisMon = new Date(t);
      thisMon.setDate(thisMon.getDate() - mondayIndex(t));
      const prevMon = new Date(thisMon);
      prevMon.setDate(prevMon.getDate() - 7);
      const prevSun = new Date(thisMon);
      prevSun.setDate(prevSun.getDate() - 1);
      return clampRangeOrder(ymd(prevMon), ymd(prevSun));
    }
    case "this_month": {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      return clampRangeOrder(ymd(first), ymd(t));
    }
    case "last_month": {
      const firstThis = new Date(t.getFullYear(), t.getMonth(), 1);
      const lastPrev = new Date(firstThis);
      lastPrev.setDate(lastPrev.getDate() - 1);
      const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
      return clampRangeOrder(ymd(firstPrev), ymd(lastPrev));
    }
    case "this_year": {
      const jan1 = new Date(t.getFullYear(), 0, 1);
      return clampRangeOrder(ymd(jan1), ymd(t));
    }
    case "last_year": {
      const y = t.getFullYear() - 1;
      return clampRangeOrder(`${y}-01-01`, `${y}-12-31`);
    }
    case "last_30":
      return defaultLast30DaysRange(now);
    case "max_span":
      return maxSpanRangeEndingToday(now);
    default:
      return defaultLast30DaysRange(now);
  }
}

export function matchQuickPreset(
  range: { from: string; to: string },
  now = new Date()
): DashboardQuickPreset | "custom" {
  for (const { id } of DASHBOARD_QUICK_PRESETS) {
    if (rangesEqual(range, rangeForQuickPreset(id, now))) return id;
  }
  return "custom";
}
