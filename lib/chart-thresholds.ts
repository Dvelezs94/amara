export type ChartThreshold = {
  id: string;
  value: number;
  label?: string;
  /** Hex color for reference line and exceeded points (default red). */
  color?: string;
};

/** Default threshold line / exceeded-point color. */
export const DEFAULT_THRESHOLD_COLOR = "#dc2626";

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeThresholdColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return undefined;
  if (trimmed.length === 4) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function resolveThresholdColor(threshold: Pick<ChartThreshold, "color">): string {
  return normalizeThresholdColor(threshold.color) ?? DEFAULT_THRESHOLD_COLOR;
}

export function createThresholdId(): string {
  return `th-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createThreshold(
  value: number,
  label?: string,
  color: string = DEFAULT_THRESHOLD_COLOR
): ChartThreshold {
  return {
    id: createThresholdId(),
    value,
    label: label?.trim() || undefined,
    color: normalizeThresholdColor(color) ?? DEFAULT_THRESHOLD_COLOR,
  };
}

export function parseChartThresholds(value: unknown): ChartThreshold[] {
  if (!Array.isArray(value)) return [];
  const out: ChartThreshold[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const num = Number(o.value);
    if (!Number.isFinite(num)) continue;
    const id =
      typeof o.id === "string" && o.id.trim() ? o.id.trim() : createThresholdId();
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    const color = normalizeThresholdColor(o.color);
    out.push({ id, value: num, label, ...(color ? { color } : {}) });
  }
  return out;
}

export function analyticsThresholdsStorageKey(
  templateId: string,
  labels: string[]
): string {
  return `msa-analytics-thresholds:${templateId}:${labels.join("|")}`;
}

export function loadThresholdsFromStorage(key: string): ChartThreshold[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return parseChartThresholds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveThresholdsToStorage(key: string, thresholds: ChartThreshold[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(thresholds));
  } catch {
    /* ignore quota */
  }
}

/** Y domain that includes data and threshold lines with padding. */
export function computeNumericChartDomain(
  data: readonly Record<string, string | number | null>[],
  seriesKeys: readonly string[],
  thresholds: readonly ChartThreshold[]
): [number, number] | ["auto", "auto"] {
  const nums: number[] = [];
  for (const row of data) {
    for (const k of seriesKeys) {
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    }
  }
  for (const t of thresholds) {
    if (Number.isFinite(t.value)) nums.push(t.value);
  }
  if (nums.length === 0) return ["auto", "auto"];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(max), 1) * 0.1;
  return [min - pad, max + pad];
}

export function valueExceedsAnyThreshold(
  value: unknown,
  thresholds: readonly ChartThreshold[]
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return thresholds.some((t) => value > t.value);
}

/** Highest exceeded threshold (for dot color on line charts). */
export function highestExceededThreshold(
  value: unknown,
  thresholds: readonly ChartThreshold[]
): ChartThreshold | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  let best: ChartThreshold | null = null;
  for (const t of thresholds) {
    if (value > t.value && (!best || t.value > best.value)) best = t;
  }
  return best;
}

/** @deprecated Use resolveThresholdColor(threshold) */
export function thresholdLineColor(_index: number): string {
  return DEFAULT_THRESHOLD_COLOR;
}
