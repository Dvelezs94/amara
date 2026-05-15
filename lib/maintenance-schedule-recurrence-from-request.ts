import {
  buildRecurrenceJson,
  computeFirstOccurrence,
  type MaintenanceFrequency,
  type MaintenanceRecurrenceRule,
} from "@/lib/maintenance-recurrence";

const FREQUENCIES: MaintenanceFrequency[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Validates `startDate`, `frequency`, `interval`, `weekdays`, `until` from a JSON body
 * (same rules as POST /api/maintenance-schedules) and builds stored recurrence + next run.
 */
export function parseRecurrencePayloadFromMaintenanceBody(
  body: Record<string, unknown>
):
  | { ok: false; error: string }
  | { ok: true; rule: MaintenanceRecurrenceRule; recurrence: string; nextRunAt: Date } {
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";
  if (!isYmd(startDate)) {
    return { ok: false, error: "startDate debe ser YYYY-MM-DD" };
  }

  const frequency = body.frequency as MaintenanceFrequency;
  if (!FREQUENCIES.includes(frequency)) {
    return { ok: false, error: "Frecuencia no válida" };
  }

  let interval = Number(body.interval);
  if (!Number.isFinite(interval) || interval < 1) interval = 1;
  interval = Math.floor(interval);
  if (interval > 365 && frequency === "daily") {
    return { ok: false, error: "Intervalo demasiado grande" };
  }

  let weekdays: number[] | undefined;
  if (
    frequency === "weekly" &&
    body.weekdays !== undefined &&
    body.weekdays !== null
  ) {
    const raw = Array.isArray(body.weekdays) ? body.weekdays : [];
    const parsed = raw
      .map((n: unknown) => Number(n))
      .filter(
        (n: number): n is number => Number.isInteger(n) && n >= 0 && n <= 6
      );
    weekdays = parsed.length > 0 ? parsed : undefined;
  }

  let until: string | null = null;
  if (body.until != null && body.until !== "") {
    const u = String(body.until).trim();
    if (!isYmd(u)) {
      return { ok: false, error: "until debe ser YYYY-MM-DD" };
    }
    if (u < startDate) {
      return { ok: false, error: "La fecha final debe ser posterior al inicio" };
    }
    until = u;
  }

  const rule: MaintenanceRecurrenceRule = {
    frequency,
    interval,
    anchorDate: startDate,
    until,
    ...(weekdays && weekdays.length > 0 ? { weekdays } : {}),
  };

  if (
    frequency === "weekly" &&
    interval > 1 &&
    rule.weekdays &&
    rule.weekdays.length > 1
  ) {
    rule.weekdays = [rule.weekdays[0]!];
  }

  const recurrence = buildRecurrenceJson(rule);
  const nextRunAt = computeFirstOccurrence(rule);
  return { ok: true, rule, recurrence, nextRunAt };
}
