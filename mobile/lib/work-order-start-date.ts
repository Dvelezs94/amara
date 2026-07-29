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

function startDateToYmd(startDate: string | Date): string | null {
  if (typeof startDate === "string") {
    const slice = startDate.trim().slice(0, 10);
    if (YMD_RE.test(slice)) return slice;
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return null;
    return ymdInTimeZone(d);
  }
  if (Number.isNaN(startDate.getTime())) return null;
  return ymdInTimeZone(startDate);
}

/** Mobile: hide tasks until their optional planned start date (fecha de inicio). */
export function isWorkOrderVisibleOnMobile(
  startDate: string | Date | null | undefined,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE
): boolean {
  if (startDate == null || startDate === "") return true;
  const startYmd = startDateToYmd(startDate);
  if (!startYmd) return true;
  return startYmd <= ymdInTimeZone(now, timeZone);
}
