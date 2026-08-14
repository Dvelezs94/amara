import { APP_TIME_ZONE } from "./due-format";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ymdInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateToYmd(value: string | Date): string | null {
  if (typeof value === "string") {
    const slice = value.trim().slice(0, 10);
    if (YMD_RE.test(slice)) return slice;
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
 * Mobile: hide tasks scheduled after today (America/Monterrey).
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
