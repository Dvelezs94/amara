import { APP_TIME_ZONE } from "@/lib/timezone";
import { dueDateFromYmd, parseScheduleYmd } from "@/lib/maintenance-schedule-work-order";

/**
 * Planned start / visibility date for a work order (fecha de inicio).
 * Distinct from `startedAt` (when work actually began).
 * When set, the mobile app only shows the task from this calendar day onward.
 */

export function ymdInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Parse optional API/form date: empty/null clears; YYYY-MM-DD or ISO → Date at local midnight when YMD. */
export function parseOptionalWorkOrderDateInput(
  value: unknown
): { ok: true; date: Date | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, date: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Fecha inválida" };
  }
  const trimmed = value.trim();
  const ymd = parseScheduleYmd(trimmed.slice(0, 10));
  if (ymd && (trimmed.length === 10 || trimmed[10] === "T")) {
    const d = dueDateFromYmd(ymd);
    if (!d) return { ok: false, error: "Fecha inválida" };
    return { ok: true, date: d };
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Fecha inválida" };
  return { ok: true, date: d };
}

function startDateToYmd(startDate: string | Date): string | null {
  if (typeof startDate === "string") {
    const ymd = parseScheduleYmd(startDate.trim().slice(0, 10));
    if (ymd) return ymd;
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return null;
    return ymdInTimeZone(d);
  }
  if (Number.isNaN(startDate.getTime())) return null;
  return ymdInTimeZone(startDate);
}

/**
 * Mobile visibility: no start date → always visible; otherwise visible when
 * today's calendar day (app TZ) is on or after the start date.
 */
export function isWorkOrderVisibleOnMobile(
  startDate: string | Date | null | undefined,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE
): boolean {
  if (startDate == null || startDate === "") return true;
  const startYmd = startDateToYmd(startDate);
  if (!startYmd) return true;
  const todayYmd = ymdInTimeZone(now, timeZone);
  return startYmd <= todayYmd;
}
