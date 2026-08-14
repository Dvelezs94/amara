import { APP_TIME_ZONE } from "@/lib/timezone";
import { dueDateFromYmd, parseScheduleYmd } from "@/lib/maintenance-schedule-work-order";

/**
 * Planned start / visibility date for a work order (fecha de inicio).
 * Distinct from `startedAt` (when work actually began).
 * The mobile app only shows the task from this calendar day onward
 * (falls back to due date when start date is empty).
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

function dateToYmd(value: string | Date): string | null {
  if (typeof value === "string") {
    const ymd = parseScheduleYmd(value.trim().slice(0, 10));
    if (ymd) return ymd;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return ymdInTimeZone(d);
  }
  if (Number.isNaN(value.getTime())) return null;
  return ymdInTimeZone(value);
}

export type WorkOrderMobileVisibilityDates = {
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
};

/**
 * Mobile visibility: hide tasks scheduled after today (app TZ).
 * Uses fecha de inicio when set; otherwise fecha de vencimiento.
 * Tasks with neither date stay visible.
 */
export function isWorkOrderVisibleOnMobile(
  dates: WorkOrderMobileVisibilityDates | null | undefined,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE
): boolean {
  const startDate = dates?.startDate;
  const dueDate = dates?.dueDate;
  const visibilityDate =
    startDate != null && startDate !== "" ? startDate : dueDate;
  if (visibilityDate == null || visibilityDate === "") return true;
  const visibilityYmd = dateToYmd(visibilityDate);
  if (!visibilityYmd) return true;
  return visibilityYmd <= ymdInTimeZone(now, timeZone);
}
