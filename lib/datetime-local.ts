import { APP_TIME_ZONE } from "@/lib/timezone";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "NaN");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

function partsToUtcMs(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) for a UTC instant in the app timezone. */
export function formatUtcDateToDatetimeLocalValue(
  date: string | Date | null | undefined,
  timeZone = APP_TIME_ZONE
): string {
  if (date == null) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = getZonedParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parse `datetime-local` input as wall time in the app timezone. */
export function parseDatetimeLocalValue(
  value: string,
  timeZone = APP_TIME_ZONE
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const desired: ZonedParts = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
  if (
    desired.month < 1 ||
    desired.month > 12 ||
    desired.day < 1 ||
    desired.day > 31 ||
    desired.hour > 23 ||
    desired.minute > 59
  ) {
    return null;
  }

  let utcMs = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute
  );
  for (let i = 0; i < 5; i++) {
    const zoned = getZonedParts(new Date(utcMs), timeZone);
    const delta = partsToUtcMs(desired) - partsToUtcMs(zoned);
    if (delta === 0) break;
    utcMs += delta;
  }
  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** Admins may set any valid completedAt (e.g. backdate for analytics). */
export function validateWorkOrderCompletedAt(_completedAt: Date): string | null {
  return null;
}
