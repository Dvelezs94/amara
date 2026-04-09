/**
 * Show tiempo transcurrido / duración unless the task is still **abierta** and has
 * never been started (no `startedAt`). Paused tasks (open again after in_progress)
 * keep `startedAt` and still show elapsed time.
 */
export function workOrderShouldShowElapsed(
  status: string,
  startedAt: string | Date | null | undefined
): boolean {
  if (status === "in_progress") return true;
  if (status === "completed") return true;
  if (status === "cancelled") return true;
  if (status === "open") {
    if (startedAt == null) return false;
    const t = new Date(startedAt);
    return !Number.isNaN(t.getTime());
  }
  return true;
}

/**
 * Human-readable duration from work order creation until completion (if closed)
 * or until `nowMs` (if still open / in progress). Spanish-friendly labels.
 * Suitable for tooltips / assistive context.
 */
export function formatWorkOrderElapsedLabel(
  createdAt: string | Date,
  status: string,
  completedAt: string | Date | null | undefined,
  nowMs: number
): string {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return "—";

  let end: Date;
  if (status === "completed") {
    if (completedAt == null) return "—";
    end = new Date(completedAt);
    if (Number.isNaN(end.getTime())) return "—";
  } else {
    end = new Date(nowMs);
  }

  const ms = Math.max(0, end.getTime() - start.getTime());
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
 * Compact duration for inline UI: `35 m`, `4h 12m`, `2d 5h` (no bold implied).
 */
export function formatWorkOrderElapsedCompact(
  createdAt: string | Date,
  status: string,
  completedAt: string | Date | null | undefined,
  nowMs: number
): string {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return "—";

  let end: Date;
  if (status === "completed") {
    if (completedAt == null) return "—";
    end = new Date(completedAt);
    if (Number.isNaN(end.getTime())) return "—";
  } else {
    end = new Date(nowMs);
  }

  const ms = Math.max(0, end.getTime() - start.getTime());
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
