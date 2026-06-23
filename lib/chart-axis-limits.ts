export type ChartAxisLimits = {
  yAuto: boolean;
  yMin: number | null;
  yMax: number | null;
  xAuto: boolean;
  xMin: number | null;
  xMax: number | null;
};

export const DEFAULT_CHART_AXIS_LIMITS: ChartAxisLimits = {
  yAuto: true,
  yMin: null,
  yMax: null,
  xAuto: true,
  xMin: null,
  xMax: null,
};

export type RechartsDomain = [number, number] | ["auto", "auto"];

export function parseChartAxisLimits(value: unknown): ChartAxisLimits {
  if (!value || typeof value !== "object") return { ...DEFAULT_CHART_AXIS_LIMITS };
  const o = value as Record<string, unknown>;
  const num = (key: string) => {
    const v = o[key];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    yAuto: o.yAuto !== false,
    yMin: num("yMin"),
    yMax: num("yMax"),
    xAuto: o.xAuto !== false,
    xMin: num("xMin"),
    xMax: num("xMax"),
  };
}

export function analyticsAxisLimitsStorageKey(
  templateId: string,
  fieldKeys: string[]
): string {
  return `msa-analytics-axis-limits:${templateId}:${fieldKeys.join("|")}`;
}

export function loadAxisLimitsFromStorage(key: string): ChartAxisLimits {
  if (typeof window === "undefined") return { ...DEFAULT_CHART_AXIS_LIMITS };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_CHART_AXIS_LIMITS };
    return parseChartAxisLimits(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CHART_AXIS_LIMITS };
  }
}

export function saveAxisLimitsToStorage(key: string, limits: ChartAxisLimits): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(limits));
  } catch {
    /* ignore quota */
  }
}

function finiteNums(values: Iterable<unknown>): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function computeAutoYDomain(
  data: readonly Record<string, string | number | null>[],
  valueKeys: readonly string[],
  extraValues: readonly number[] = []
): RechartsDomain {
  const nums = [...extraValues];
  for (const row of data) {
    for (const k of valueKeys) {
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
    }
  }
  if (nums.length === 0) return ["auto", "auto"];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(max), 1) * 0.1;
  return [min - pad, max + pad];
}

export function computeAutoXDomainFromTimestamps(
  data: readonly { ts?: unknown }[]
): RechartsDomain {
  const nums = finiteNums(data.map((r) => r.ts));
  if (nums.length === 0) return ["auto", "auto"];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span > 0 ? span * 0.02 : 3_600_000;
  return [min - pad, max + pad];
}

export function resolveYAxisDomain(
  limits: ChartAxisLimits,
  autoDomain: RechartsDomain
): RechartsDomain {
  if (limits.yAuto) return autoDomain;
  const [autoMin, autoMax] =
    autoDomain[0] === "auto" ? [null, null] : [autoDomain[0], autoDomain[1]];
  let min = limits.yMin ?? autoMin;
  let max = limits.yMax ?? autoMax;
  if (min == null && max == null) return ["auto", "auto"];
  if (min == null) min = max! - 1;
  if (max == null) max = min + 1;
  if (max <= min) max = min + 1;
  return [min, max];
}

export function resolveXAxisDomain(
  limits: ChartAxisLimits,
  autoDomain: RechartsDomain
): RechartsDomain {
  if (limits.xAuto) return autoDomain;
  const [autoMin, autoMax] =
    autoDomain[0] === "auto" ? [null, null] : [autoDomain[0], autoDomain[1]];
  let min = limits.xMin ?? autoMin;
  let max = limits.xMax ?? autoMax;
  if (min == null && max == null) return ["auto", "auto"];
  if (min == null) min = max! - 86_400_000;
  if (max == null) max = min + 86_400_000;
  if (max <= min) max = min + 86_400_000;
  return [min, max];
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) from epoch ms in a timezone. */
export function epochMsToDatetimeLocalValue(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const min = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${y}-${m}-${d}T${h}:${min}`;
}

/** Parse `datetime-local` as wall time in the given IANA timezone → epoch ms. */
export function datetimeLocalValueToEpochMs(value: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (![y, mo, d, h, mi].every(Number.isFinite)) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = timezoneOffsetMs(guess, timeZone);
  return guess - offset;
}

function timezoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );
  return asUtc - utcMs;
}
