export function maintenanceScheduleWorkOrderDescription(
  scheduleId: string,
  scheduleName?: string | null
): string {
  const name = scheduleName?.trim();
  if (name) {
    return `Generada desde calendario de mantenimiento: ${name} (${scheduleId}).`;
  }
  return `Generada desde calendario de mantenimiento (${scheduleId}).`;
}

/** SQL LIKE: any calendar-generated work order (legacy or named). */
export const CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE =
  "%calendario de mantenimiento%(%";

export function maintenanceScheduleWorkOrderDescriptionPattern(
  scheduleId: string
): string {
  return `%calendario de mantenimiento%(${scheduleId})%`;
}

/** Parses calendar-generated work order copy (name optional for older rows). */
export function parseMaintenanceScheduleWorkOrderDescription(
  raw: string | null | undefined
): { scheduleId: string; name: string | null } | null {
  if (!raw) return null;
  const text = raw.trim();
  const withName = text.match(
    /^Generada desde calendario de mantenimiento:\s*(.+)\s+\(([^)]+)\)\.\s*$/
  );
  if (withName?.[1] && withName[2]) {
    return { name: withName[1].trim(), scheduleId: withName[2].trim() };
  }
  const legacy = text.match(
    /^Generada desde calendario de mantenimiento \(([^)]+)\)\.\s*$/
  );
  if (legacy?.[1]) {
    return { name: null, scheduleId: legacy[1].trim() };
  }
  return null;
}

export function calendarEventHref(
  scheduleId: string,
  dateYmd?: string | null
): string {
  const params = new URLSearchParams({ evento: scheduleId });
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    params.set("fecha", dateYmd);
  }
  return `/calendario?${params.toString()}`;
}

export function parseCalendarEventSearchParams(input: {
  evento?: string | null;
  fecha?: string | null;
}): { scheduleId: string; dateYmd: string | null } | null {
  const scheduleId = typeof input.evento === "string" ? input.evento.trim() : "";
  if (!scheduleId) return null;
  const fecha = typeof input.fecha === "string" ? input.fecha.trim() : "";
  return {
    scheduleId,
    dateYmd: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
  };
}

export function parseScheduleYmd(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function dueDateFromYmd(dateYmd: string): Date | null {
  const d = new Date(`${dateYmd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayBoundsFromYmd(dateYmd: string): { start: Date; end: Date } | null {
  const start = new Date(`${dateYmd}T00:00:00`);
  const end = new Date(`${dateYmd}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function scheduleWorkOrderMarkerKey(scheduleId: string, dateYmd: string): string {
  return `${scheduleId}|${dateYmd}`;
}

export type CalendarWorkOrderMarkerRow = {
  description: string | null;
  dueDate: Date | string | null;
  status: string;
};

/**
 * Builds `scheduleId|YYYY-MM-DD` → status from calendar-created work orders.
 * Used by GET /api/maintenance-schedules/work-order-markers.
 */
export function buildCalendarWorkOrderMarkers(
  rows: CalendarWorkOrderMarkerRow[],
  dueDateToYmd: (dueDate: Date) => string
): Record<string, string> {
  const markers: Record<string, string> = {};
  for (const row of rows) {
    if (!row.description || row.dueDate == null || row.dueDate === "") continue;
    const parsed = parseMaintenanceScheduleWorkOrderDescription(row.description);
    if (!parsed) continue;
    const due =
      row.dueDate instanceof Date ? row.dueDate : new Date(row.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    markers[scheduleWorkOrderMarkerKey(parsed.scheduleId, dueDateToYmd(due))] =
      row.status;
  }
  return markers;
}

/**
 * Whether a calendar-created work order for this schedule falls on dateYmd
 * (same day filter the event panel and create-work-order uniqueness use).
 */
export function workOrderMatchesScheduleDay(input: {
  description: string | null | undefined;
  dueDate: Date | string | null | undefined;
  scheduleId: string;
  dateYmd: string;
  dueDateToYmd: (dueDate: Date) => string;
}): boolean {
  if (!input.description || input.dueDate == null || input.dueDate === "") {
    return false;
  }
  const parsed = parseMaintenanceScheduleWorkOrderDescription(input.description);
  if (!parsed || parsed.scheduleId !== input.scheduleId) return false;
  const due =
    input.dueDate instanceof Date
      ? input.dueDate
      : new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return input.dueDateToYmd(due) === input.dateYmd;
}

export {
  workOrderStatusMarkerColor,
  workOrderStatusMarkerLabel,
} from "@/lib/work-order-status-colors";
