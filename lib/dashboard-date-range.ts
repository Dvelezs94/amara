/**
 * Helpers for dashboard date range (local calendar YYYY-MM-DD).
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start of local calendar day for YYYY-MM-DD. */
export function startOfLocalDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** End of local calendar day for YYYY-MM-DD. */
export function endOfLocalDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Inclusive calendar days from `fromYmd` through `toYmd` (same day = 1). */
export function inclusiveLocalDayCount(fromYmd: string, toYmd: string): number {
  const a = startOfLocalDayFromYmd(fromYmd);
  const b = startOfLocalDayFromYmd(toYmd);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/** Default dashboard window: last 30 calendar days inclusive (today and 29 prior days). */
export function defaultLast30DaysRange(now = new Date()): { from: string; to: string } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toYmdLocal(from), to: toYmdLocal(to) };
}

export function rangesEqual(
  a: { from: string; to: string },
  b: { from: string; to: string }
): boolean {
  return a.from === b.from && a.to === b.to;
}

export function isDefaultLast30DaysRange(
  range: { from: string; to: string },
  now = new Date()
): boolean {
  return rangesEqual(range, defaultLast30DaysRange(now));
}

const MAX_RANGE_DAYS = 731;

export function clampRangeOrder(from: string, to: string): { from: string; to: string } {
  if (!isValidYmd(from) || !isValidYmd(to)) return { from, to };
  let a = from;
  let b = to;
  if (startOfLocalDayFromYmd(a) > startOfLocalDayFromYmd(b)) {
    [a, b] = [b, a];
  }
  const days = inclusiveLocalDayCount(a, b);
  if (days <= MAX_RANGE_DAYS) return { from: a, to: b };
  const end = startOfLocalDayFromYmd(b);
  const start = new Date(end);
  start.setDate(start.getDate() - (MAX_RANGE_DAYS - 1));
  return { from: toYmdLocal(start), to: b };
}
