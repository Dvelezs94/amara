/**
 * Show tiempo transcurrido / duración once the task has been initiated
 * (`startedAt` set when first moved to in_progress). Paused tasks (pending again)
 * keep `startedAt` and still show elapsed time until closed.
 */
export function workOrderShouldShowElapsed(
  status: string,
  startedAt: string | Date | null | undefined
): boolean {
  if (startedAt == null) return false;
  const t = new Date(startedAt);
  if (Number.isNaN(t.getTime())) return false;
  return (
    status === "in_progress" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "pending"
  );
}

function resolveElapsedWindow(
  startedAt: string | Date | null | undefined,
  status: string,
  completedAt: string | Date | null | undefined,
  nowMs: number
): { startMs: number; endMs: number } | null {
  if (startedAt == null) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;

  let end: Date;
  if (status === "completed" || status === "cancelled") {
    if (completedAt == null) return null;
    end = new Date(completedAt);
    if (Number.isNaN(end.getTime())) return null;
  } else {
    end = new Date(nowMs);
  }

  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Human-readable duration from first initiation (`startedAt` / en progreso)
 * until completion (if closed) or until `nowMs` (if still open / in progress).
 */
export function formatWorkOrderElapsedLabel(
  startedAt: string | Date | null | undefined,
  status: string,
  completedAt: string | Date | null | undefined,
  nowMs: number
): string {
  const window = resolveElapsedWindow(startedAt, status, completedAt, nowMs);
  if (!window) return "—";

  const ms = Math.max(0, window.endMs - window.startMs);
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "menos de 1 minuto";
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? "1 minuto" : `${totalMinutes} minutos`;
  }

  const totalHours = ms / 3600000;
  if (totalHours < 24) {
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
    return `${h} h ${m} min`;
  }

  const days = Math.floor(totalHours / 24);
  const remH = Math.round(totalHours - days * 24);
  if (remH === 0) return days === 1 ? "1 día" : `${days} días`;
  return `${days === 1 ? "1 día" : `${days} días`} ${remH} h`;
}

/**
 * Compact duration for inline UI: `35 m`, `4h 12m`, `2d 5h`.
 * Counts from initiation (`startedAt`) to closed / now.
 */
export function formatWorkOrderElapsedCompact(
  startedAt: string | Date | null | undefined,
  status: string,
  completedAt: string | Date | null | undefined,
  nowMs: number
): string {
  const window = resolveElapsedWindow(startedAt, status, completedAt, nowMs);
  if (!window) return "—";

  const ms = Math.max(0, window.endMs - window.startMs);
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "<1 m";

  const dayMin = 24 * 60;
  if (totalMin < 60) {
    return `${totalMin} m`;
  }

  const d = Math.floor(totalMin / dayMin);
  const remAfterDays = totalMin - d * dayMin;
  const h = Math.floor(remAfterDays / 60);
  const m = remAfterDays % 60;

  if (d > 0) {
    const parts: string[] = [`${d}d`];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(" ");
  }

  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
