export function maintenanceScheduleWorkOrderDescription(scheduleId: string): string {
  return `Generada desde calendario de mantenimiento (${scheduleId}).`;
}

export function maintenanceScheduleWorkOrderDescriptionPattern(scheduleId: string): string {
  return `%calendario de mantenimiento (${scheduleId})%`;
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

export {
  workOrderStatusMarkerColor,
  workOrderStatusMarkerLabel,
} from "@/lib/work-order-status-colors";
