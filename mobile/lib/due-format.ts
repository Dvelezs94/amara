export const APP_TIME_ZONE = "America/Monterrey";
export const RELATIVE_DUE_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDaysFromToday(dueStr: string, now = new Date()): number | null {
  const due = new Date(dueStr);
  if (Number.isNaN(due.getTime())) return null;
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  return Math.round((startDue.getTime() - startToday.getTime()) / DAY_MS);
}

export function formatDueShortDate(s: string, timeZone = APP_TIME_ZONE): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    month: "short",
    day: "numeric",
    timeZone,
  });
}

/** Spanish relative due copy (same idea as web `WorkOrderList` `formatDueRelative`) */
export function formatDueRelative(s: string | null, now = new Date()): string {
  if (!s) return "—";
  const diff = calendarDaysFromToday(s, now);
  if (diff === null) return "—";
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff >= 2 && diff <= RELATIVE_DUE_MAX_DAYS) return `Vence en ${diff} días`;
  if (diff > RELATIVE_DUE_MAX_DAYS) return `Vence el ${formatDueShortDate(s)}`;
  if (diff === -1) return "Venció ayer";
  if (diff <= -2 && diff >= -RELATIVE_DUE_MAX_DAYS) return `Venció hace ${-diff} días`;
  return `Venció el ${formatDueShortDate(s)}`;
}

/** Short label for time until due (e.g. 45m, 1.5h, 3d) */
export function formatDurationUntilDueShort(dueDate: string | null, now = new Date()): string {
  if (!dueDate) return "—";
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return "—";
  const ms = due - now.getTime();
  if (ms < 0) return "Vencida";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = ms / 3600000;
  if (h < 48) {
    const rounded = Math.round(h * 10) / 10;
    return rounded % 1 === 0 ? `${Math.round(rounded)}h` : `${rounded}h`;
  }
  const d = Math.ceil(ms / (24 * 3600000));
  return `${d}d`;
}
