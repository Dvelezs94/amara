export const WORK_ORDER_STATUS_COLOR_SETTINGS_KEY = "work_order_status_colors";

export const WORK_ORDER_STATUS_KEYS = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type WorkOrderStatusKey = (typeof WORK_ORDER_STATUS_KEYS)[number];

export type WorkOrderStatusColors = Record<WorkOrderStatusKey, string>;

export const DEFAULT_WORK_ORDER_STATUS_COLORS: WorkOrderStatusColors = {
  pending: "#fbbf24",
  in_progress: "#60a5fa",
  completed: "#86efac",
  cancelled: "#d4d4d8",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatusKey, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeStatusHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function parseWorkOrderStatusColors(value: unknown): WorkOrderStatusColors | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out = { ...DEFAULT_WORK_ORDER_STATUS_COLORS };
  let any = false;
  for (const key of WORK_ORDER_STATUS_KEYS) {
    const hex = normalizeStatusHexColor(raw[key]);
    if (hex) {
      out[key] = hex;
      any = true;
    }
  }
  return any ? out : null;
}

export function resolveWorkOrderStatusColor(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): string {
  const key = status as WorkOrderStatusKey;
  if (colors?.[key]) return colors[key]!;
  return DEFAULT_WORK_ORDER_STATUS_COLORS[key] ?? "#a1a1aa";
}

export function workOrderStatusMarkerColor(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): string {
  return resolveWorkOrderStatusColor(status, colors);
}

export function workOrderStatusMarkerLabel(status: string): string {
  const key = status as WorkOrderStatusKey;
  if (key in WORK_ORDER_STATUS_LABELS) {
    return `Tarea ${WORK_ORDER_STATUS_LABELS[key].toLowerCase()}`;
  }
  return "Tarea asociada";
}

export function workOrderStatusBadgeStyle(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): { backgroundColor: string; color: string } {
  const hex = resolveWorkOrderStatusColor(status, colors);
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 22%, white)`,
    color: `color-mix(in srgb, ${hex} 72%, #09090b)`,
  };
}

/** Border + fill for the status `<select>` (uses the user’s status colors). */
export function workOrderStatusSelectStyle(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): {
  borderColor: string;
  backgroundColor: string;
  color: string;
  ["--tw-ring-color"]: string;
} {
  const hex = resolveWorkOrderStatusColor(status, colors);
  return {
    borderColor: hex,
    backgroundColor: `color-mix(in srgb, ${hex} 18%, white)`,
    color: `color-mix(in srgb, ${hex} 72%, #09090b)`,
    ["--tw-ring-color"]: `color-mix(in srgb, ${hex} 35%, transparent)`,
  };
}
