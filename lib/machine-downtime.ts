const MS_PER_MIN = 60_000;
/** ~1 year in minutes — upper bound for manual entry */
export const MAX_MANUAL_DOWNTIME_MINUTES = 525_600;

export function clampManualDowntimeMinutes(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > MAX_MANUAL_DOWNTIME_MINUTES) return null;
  return n;
}

/** Activo permite registrar paro de máquina en sus tareas (por defecto sí). */
export function assetAllowsWorkOrderDowntimeTracking(
  assetTracks: boolean | null | undefined
): boolean {
  return assetTracks !== false;
}

/** La tarea cuenta paro solo si está marcada y el activo no lo deshabilitó. */
export function effectiveCountsMachineDowntime(
  workOrderCounts: boolean | undefined,
  assetTracks: boolean | null | undefined
): boolean {
  return (
    workOrderCounts === true && assetAllowsWorkOrderDowntimeTracking(assetTracks)
  );
}

/**
 * Automatic contribution: from first `startedAt` to `completedAt` while the WO was in progress,
 * only when `countsMachineDowntime` and the WO is completed with both timestamps.
 */
export function workOrderAutomaticDowntimeMinutes(input: {
  status: string;
  countsMachineDowntime: boolean;
  startedAt: string | Date | null | undefined;
  completedAt: string | Date | null | undefined;
}): number {
  if (input.status !== "completed" || !input.countsMachineDowntime) return 0;
  if (input.startedAt == null || input.completedAt == null) return 0;
  const a = new Date(input.startedAt);
  const b = new Date(input.completedAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ms = Math.max(0, b.getTime() - a.getTime());
  return Math.floor(ms / MS_PER_MIN);
}

/** Live preview for in-progress WOs (same interval as automatic at completion). */
export function workOrderInProgressDowntimeMinutesSoFar(input: {
  status: string;
  countsMachineDowntime: boolean;
  startedAt: string | Date | null | undefined;
  nowMs: number;
}): number {
  if (input.status !== "in_progress" || !input.countsMachineDowntime) return 0;
  if (input.startedAt == null) return 0;
  const a = new Date(input.startedAt);
  if (Number.isNaN(a.getTime())) return 0;
  const ms = Math.max(0, input.nowMs - a.getTime());
  return Math.floor(ms / MS_PER_MIN);
}

export function workOrderTotalDowntimeMinutesForAsset(input: {
  status: string;
  assetId: string | null;
  countsMachineDowntime: boolean;
  startedAt: string | Date | null | undefined;
  completedAt: string | Date | null | undefined;
  manualDowntimeMinutes: number | null | undefined;
}): number {
  if (input.assetId == null) return 0;
  if (input.status !== "completed") return 0;
  const manual = Math.max(
    0,
    Math.min(
      MAX_MANUAL_DOWNTIME_MINUTES,
      typeof input.manualDowntimeMinutes === "number" &&
        Number.isFinite(input.manualDowntimeMinutes)
        ? Math.floor(input.manualDowntimeMinutes)
        : 0
    )
  );
  return (
    workOrderAutomaticDowntimeMinutes({
      status: input.status,
      countsMachineDowntime: input.countsMachineDowntime,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    }) + manual
  );
}

export function formatDowntimeMinutesSpanish(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m < 1) return "0 min";
  if (m < 60) return m === 1 ? "1 min" : `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${rem} min`;
}
