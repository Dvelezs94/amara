export type WoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/** API + DB use `pending`; legacy rows or clients may still send `open`. */
export function normalizeWoStatus(raw: unknown): WoStatus {
  if (raw === "open") return "pending";
  if (raw === "pending" || raw === "in_progress" || raw === "completed" || raw === "cancelled") {
    return raw;
  }
  return "pending";
}

export function statusLabel(status: WoStatus): string {
  if (status === "pending") return "Pendiente";
  if (status === "in_progress") return "En progreso";
  if (status === "completed") return "Completada";
  return "Cancelada";
}
