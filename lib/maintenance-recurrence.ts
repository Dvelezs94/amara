/**
 * Recurrence rules for preventive maintenance / calendar events.
 * Stored as JSON string in `maintenance_schedules.recurrence`.
 */

const MS_DAY = 86_400_000;

export type MaintenanceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type MaintenanceRecurrenceRule = {
  frequency: MaintenanceFrequency;
  /** Every N days / weeks / months / years (default 1) */
  interval: number;
  /**
   * For weekly: 0=domingo … 6=sábado (Date.getDay()).
   * If omitted or empty, se usa el día de la semana de `anchorDate`.
   */
  weekdays?: number[];
  /** YYYY-MM-DD — fin de la serie (opcional) */
  until?: string | null;
  /** YYYY-MM-DD — fechas omitidas de una serie */
  excludedDates?: string[];
  /** YYYY-MM-DD — primera fecha elegida por el usuario */
  anchorDate: string;
};

export function parseRecurrence(raw: string): MaintenanceRecurrenceRule | null {
  try {
    const o = JSON.parse(raw) as Partial<MaintenanceRecurrenceRule>;
    if (o && typeof o.frequency === "string" && typeof o.anchorDate === "string") {
      const interval =
        typeof o.interval === "number" && o.interval >= 1
          ? Math.floor(o.interval)
          : 1;
      return {
        frequency: o.frequency as MaintenanceFrequency,
        interval,
        weekdays: Array.isArray(o.weekdays)
          ? o.weekdays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
          : undefined,
        until: o.until ?? null,
        excludedDates: Array.isArray(o.excludedDates)
          ? o.excludedDates.filter((v): v is string => typeof v === "string")
          : undefined,
        anchorDate: o.anchorDate,
      };
    }
  } catch {
    /* legacy texto plano */
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return new Date(NaN);
  return new Date(y, m - 1, day);
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(date: Date, n: number): Date {
  const d = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();
  next.setDate(Math.min(d, lastDay));
  return startOfDay(next);
}

function addYears(date: Date, n: number): Date {
  const next = new Date(date.getFullYear() + n, date.getMonth(), date.getDate());
  return startOfDay(next);
}

/** First date >= anchor where getDay() === w (0–6). */
function firstWeekdayOnOrAfter(anchor: Date, w: number): Date {
  let d = startOfDay(anchor);
  for (let i = 0; i < 14; i++) {
    if (d.getDay() === w && d >= startOfDay(anchor)) return d;
    d = new Date(d.getTime() + MS_DAY);
  }
  return startOfDay(anchor);
}

function weekdaysFromRule(rule: MaintenanceRecurrenceRule, anchor: Date): number[] {
  if (rule.weekdays && rule.weekdays.length > 0) {
    return Array.from(new Set(rule.weekdays)).sort((a, b) => a - b);
  }
  return [anchor.getDay()];
}

/** Primera ocurrencia de la serie (para `nextRunAt`). */
export function computeFirstOccurrence(rule: MaintenanceRecurrenceRule): Date {
  const anchor = startOfDay(parseYmdToLocalDate(rule.anchorDate));
  if (Number.isNaN(anchor.getTime())) return new Date();

  const interval = Math.max(1, Math.floor(rule.interval || 1));

  switch (rule.frequency) {
    case "none":
      return anchor;
    case "daily":
      return anchor;
    case "weekly": {
      if (interval === 1) {
        const days = weekdaysFromRule(rule, anchor);
        let best: Date | null = null;
        for (const w of days) {
          const cand = firstWeekdayOnOrAfter(anchor, w);
          if (!best || cand < best) best = cand;
        }
        return best ?? anchor;
      }
      const days = weekdaysFromRule(rule, anchor);
      const w = days[0]!;
      const first = firstWeekdayOnOrAfter(anchor, w);
      return first;
    }
    case "monthly":
    case "yearly":
      return anchor;
    default:
      return anchor;
  }
}

export function expandOccurrencesInRange(
  rule: MaintenanceRecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const anchor = startOfDay(parseYmdToLocalDate(rule.anchorDate));
  if (Number.isNaN(anchor.getTime())) return [];

  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const until = rule.until
    ? startOfDay(parseYmdToLocalDate(rule.until))
    : null;
  if (until && !Number.isNaN(until.getTime()) && until < start) return [];

  const capEnd =
    until && !Number.isNaN(until.getTime()) && until < end ? until : end;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const out: Date[] = [];
  const excluded = new Set(rule.excludedDates ?? []);

  const pushInRange = (d: Date) => {
    if (d >= start && d <= capEnd && d >= anchor) {
      if (excluded.has(toYmdLocal(d))) return;
      out.push(new Date(d));
    }
  };

  switch (rule.frequency) {
    case "none":
      pushInRange(anchor);
      break;
    case "daily": {
      let d = new Date(Math.max(anchor.getTime(), start.getTime()));
      while (d <= capEnd) {
        const daysSince = Math.round((d.getTime() - anchor.getTime()) / MS_DAY);
        if (daysSince >= 0 && daysSince % interval === 0 && !excluded.has(toYmdLocal(d))) {
          out.push(new Date(d));
        }
        d = new Date(d.getTime() + MS_DAY);
      }
      break;
    }
    case "weekly": {
      const weekdays = weekdaysFromRule(rule, anchor);
      if (interval === 1) {
        let d = new Date(Math.max(anchor.getTime(), start.getTime()));
        while (d <= capEnd) {
          if (d >= anchor && weekdays.includes(d.getDay()) && !excluded.has(toYmdLocal(d)))
            out.push(new Date(d));
          d = new Date(d.getTime() + MS_DAY);
        }
      } else {
        const w = weekdays[0]!;
        const first = firstWeekdayOnOrAfter(anchor, w);
        let k = 0;
        while (true) {
          const d = new Date(first.getTime() + k * interval * 7 * MS_DAY);
          if (d > capEnd) break;
          pushInRange(d);
          k++;
        }
      }
      break;
    }
    case "monthly": {
      let d = new Date(anchor);
      while (d < start) d = addMonths(d, interval);
      while (d <= capEnd) {
        pushInRange(d);
        d = addMonths(d, interval);
      }
      break;
    }
    case "yearly": {
      let d = new Date(anchor);
      while (d < start) d = addYears(d, interval);
      while (d <= capEnd) {
        pushInRange(d);
        d = addYears(d, interval);
      }
      break;
    }
  }

  return out.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Primera ocurrencia de la regla en el intervalo que empieza el día local de `from` (inclusive).
 */
export function nextScheduledOccurrenceOnOrAfter(
  rule: MaintenanceRecurrenceRule,
  from: Date,
  horizonDays = 370
): Date | null {
  const rangeStart = startOfDay(from);
  const rangeEnd = new Date(rangeStart.getTime() + horizonDays * MS_DAY);
  const occ = expandOccurrencesInRange(rule, rangeStart, rangeEnd);
  return occ.length > 0 ? occ[0]! : null;
}

/**
 * Próxima fecha a mostrar en listados (p. ej. dashboard): prioriza la regla JSON;
 * si no hay regla parseable, usa `nextRunAt` si sigue siendo vigente.
 */
export function resolveNextMaintenanceDisplayDate(
  recurrenceRaw: string,
  nextRunAt: Date | null,
  from: Date
): Date | null {
  const startToday = startOfDay(from);
  const rule = parseRecurrence(recurrenceRaw);
  if (rule) {
    const d = nextScheduledOccurrenceOnOrAfter(rule, from);
    if (d) return d;
  }
  if (nextRunAt != null && nextRunAt.getTime() >= startToday.getTime()) {
    return nextRunAt;
  }
  return null;
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function formatRecurrenceLabel(raw: string): string {
  const rule = parseRecurrence(raw);
  if (!rule) return raw;

  const iv = Math.max(1, rule.interval);
  const parts: string[] = [];

  switch (rule.frequency) {
    case "none":
      return "No se repite";
    case "daily":
      parts.push(iv === 1 ? "Cada día" : `Cada ${iv} días`);
      break;
    case "weekly": {
      if (iv === 1) {
        const days = weekdaysFromRule(rule, parseYmdToLocalDate(rule.anchorDate));
        if (days.length === 7) {
          parts.push("Cada semana (todos los días)");
        } else {
          const names = days.map((d) => WEEKDAY_LABELS[d]).join(", ");
          parts.push(`Cada semana: ${names}`);
        }
      } else {
        parts.push(
          iv === 2
            ? "Cada 2 semanas (mismo día de la semana)"
            : `Cada ${iv} semanas (mismo día de la semana)`
        );
      }
      break;
    }
    case "monthly":
      parts.push(iv === 1 ? "Cada mes" : `Cada ${iv} meses`);
      break;
    case "yearly":
      parts.push(iv === 1 ? "Cada año" : `Cada ${iv} años`);
      break;
  }

  if (rule.until) {
    parts.push(`hasta el ${rule.until}`);
  }

  return parts.join(" · ");
}

export function buildRecurrenceJson(rule: MaintenanceRecurrenceRule): string {
  const normalized: MaintenanceRecurrenceRule = {
    frequency: rule.frequency,
    interval: Math.max(1, Math.floor(rule.interval || 1)),
    anchorDate: rule.anchorDate,
    until: rule.until ?? null,
  };
  if (
    rule.frequency === "weekly" &&
    rule.weekdays &&
    rule.weekdays.length > 0
  ) {
    normalized.weekdays = Array.from(new Set(rule.weekdays)).sort(
      (a, b) => a - b
    );
  }
  if (rule.excludedDates && rule.excludedDates.length > 0) {
    normalized.excludedDates = Array.from(new Set(rule.excludedDates)).sort();
  }
  return JSON.stringify(normalized);
}
