/** User-configurable work-order status colors (mirrors web `lib/work-order-status-colors`). */

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

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeStatusHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function toHexByte(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0");
}

/** Mix `amount` (0–1) of `hex` with `(1 - amount)` of `withHex` (SRGB-ish linear mix). */
export function mixHexColors(hex: string, withHex: string, amount: number): string {
  const a = parseHexRgb(hex);
  const b = parseHexRgb(withHex);
  if (!a || !b) return normalizeStatusHexColor(hex) ?? "#a1a1aa";
  const t = Math.min(1, Math.max(0, amount));
  return `#${toHexByte(a.r * t + b.r * (1 - t))}${toHexByte(a.g * t + b.g * (1 - t))}${toHexByte(
    a.b * t + b.b * (1 - t)
  )}`;
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

export function mergeWorkOrderStatusColors(
  value: unknown
): WorkOrderStatusColors {
  return parseWorkOrderStatusColors(value) ?? { ...DEFAULT_WORK_ORDER_STATUS_COLORS };
}

export function resolveWorkOrderStatusColor(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): string {
  const key = status as WorkOrderStatusKey;
  if (colors?.[key]) return colors[key]!;
  return DEFAULT_WORK_ORDER_STATUS_COLORS[key] ?? "#a1a1aa";
}

/** RN badge styles matching web `workOrderStatusBadgeStyle` (soft fill + dark text, no border). */
export function workOrderStatusBadgeStyleRn(
  status: string,
  colors?: Partial<WorkOrderStatusColors> | null
): { backgroundColor: string; color: string } {
  const hex = resolveWorkOrderStatusColor(status, colors);
  return {
    backgroundColor: mixHexColors(hex, "#ffffff", 0.22),
    color: mixHexColors(hex, "#09090b", 0.72),
  };
}
