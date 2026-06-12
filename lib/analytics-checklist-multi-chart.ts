/**
 * Build datasets for analytics when several checklist fields share the same `fieldType`.
 */

import {
  displayLabelForFieldKey,
  findChecklistItemByFieldKey,
  type AnalyticsChecklistTreeItem,
} from "@/lib/analytics-checklist-field-key";
import { workOrderCountsForChecklistAnalytics } from "@/lib/work-order-analytics";

export type ChecklistRow = AnalyticsChecklistTreeItem & {
  fieldType: string | null;
  value: unknown;
};

export type WoChecklistRow = {
  status?: string | null;
  completedAt: string | null;
  checklistItems: ChecklistRow[];
};

function analyticsEligibleWo(wo: WoChecklistRow): boolean {
  const status = wo.status ?? "completed";
  return workOrderCountsForChecklistAnalytics(status, wo.completedAt);
}

export function normalizeWidgetFieldLabels(
  fieldLabel: string,
  fieldLabels?: string[] | null
): string[] {
  const raw = Array.isArray(fieldLabels) ? fieldLabels : [];
  const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);
  if (cleaned.length) return Array.from(new Set(cleaned));
  const one = String(fieldLabel).trim();
  return one ? [one] : [];
}

export function fieldTypeForKey(
  workOrders: WoChecklistRow[],
  fieldKey: string
): string | null {
  for (const wo of workOrders) {
    const it = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
    if (it?.fieldType) return it.fieldType;
  }
  return null;
}

/** Returns shared type if all selected field keys resolve to the same `fieldType`; otherwise null. */
export function commonFieldType(
  workOrders: WoChecklistRow[],
  fieldKeys: string[]
): string | null {
  if (!fieldKeys.length) return null;
  const types = fieldKeys.map((k) => fieldTypeForKey(workOrders, k));
  const first = types.find((t) => t != null);
  if (!first) return null;
  for (const t of types) {
    if (t != null && t !== first) return null;
  }
  return first;
}

export function seriesKeyAt(index: number): string {
  return `s${index}`;
}

export function categoricalSeriesKeyAt(index: number): string {
  return `d${index}`;
}

/** Calendar day (YYYY-MM-DD) for a timestamp in the given IANA timezone. */
export function formatYmdInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

export function formatDayLabelShort(ymd: string, timeZone: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return noon.toLocaleDateString("es-MX", {
    month: "short",
    day: "numeric",
    timeZone,
  });
}

function normalizeCategoricalValue(value: unknown): string {
  const raw = value != null ? String(value).trim() : "";
  return raw === "" ? "(vacío)" : raw;
}

/**
 * Stacked-bar time series: one row per calendar day, one series key per dropdown option.
 */
export function buildCategoricalDailyTimeData(
  workOrders: WoChecklistRow[],
  fieldKey: string,
  timeZone: string
): { data: Record<string, string | number>[]; series: { key: string; name: string }[] } {
  const dayMap = new Map<string, Map<string, number>>();
  const categorySet = new Set<string>();

  for (const wo of workOrders) {
    if (!analyticsEligibleWo(wo) || wo.completedAt == null) continue;
    const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
    if (!item) continue;
    const day = formatYmdInTimeZone(new Date(wo.completedAt), timeZone);
    const cat = normalizeCategoricalValue(item.value);
    categorySet.add(cat);
    if (!dayMap.has(day)) dayMap.set(day, new Map());
    const counts = dayMap.get(day)!;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b, "es"));
  const series = categories.map((name, i) => ({
    key: categoricalSeriesKeyAt(i),
    name,
  }));

  const days = Array.from(dayMap.keys()).sort();
  const data = days.map((day) => {
    const row: Record<string, string | number> = {
      day,
      dateLabel: formatDayLabelShort(day, timeZone),
    };
    const counts = dayMap.get(day)!;
    categories.forEach((cat, i) => {
      row[categoricalSeriesKeyAt(i)] = counts.get(cat) ?? 0;
    });
    return row;
  });

  return { data, series };
}

export function buildMultiNumberTimeData(
  workOrders: WoChecklistRow[],
  fieldKeys: string[],
  timeZone: string
): { data: Record<string, string | number | null>[]; series: { key: string; name: string }[] } {
  const series = fieldKeys.map((key, i) => ({
    key: seriesKeyAt(i),
    name: displayLabelForFieldKey(workOrders, key),
  }));
  const rows: Record<string, string | number | null>[] = [];
  for (const wo of workOrders) {
    if (!analyticsEligibleWo(wo)) continue;
    const ts = wo.completedAt ? new Date(wo.completedAt).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    const row: Record<string, string | number | null> = {
      ts,
      date: new Date(ts).toLocaleString("es-MX", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    };
    let any = false;
    fieldKeys.forEach((fieldKey, i) => {
      const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
      const val = item?.value != null ? Number(item.value) : null;
      const k = seriesKeyAt(i);
      if (val != null && !Number.isNaN(val)) {
        row[k] = Math.round(val * 100) / 100;
        any = true;
      } else {
        row[k] = null;
      }
    });
    if (any) rows.push(row);
  }
  rows.sort((a, b) => Number(a.ts) - Number(b.ts));
  return { data: rows, series };
}

/** One grouped cluster per field: sí vs no counts. */
export function buildMultiCheckboxBars(
  workOrders: WoChecklistRow[],
  fieldKeys: string[]
): { name: string; sí: number; no: number }[] {
  return fieldKeys.map((fieldKey) => {
    let sí = 0;
    let no = 0;
    for (const wo of workOrders) {
      if (!analyticsEligibleWo(wo)) continue;
      const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
      if (!item) continue;
      if (item.value === true) sí++;
      else no++;
    }
    const display = displayLabelForFieldKey(workOrders, fieldKey);
    const short = display.length > 28 ? `${display.slice(0, 26)}…` : display;
    return { name: short, sí, no };
  });
}

/** Union of category labels across fields; one bar group per category with one bar per field. */
export function buildMultiCategoricalUnion(
  workOrders: WoChecklistRow[],
  fieldKeys: string[]
): { data: Record<string, string | number>[]; series: { key: string; name: string }[] } {
  const series = fieldKeys.map((key, i) => ({
    key: `c${i}`,
    name: displayLabelForFieldKey(workOrders, key),
  }));
  const union = new Set<string>();
  for (const fieldKey of fieldKeys) {
    for (const wo of workOrders) {
      if (!analyticsEligibleWo(wo)) continue;
      const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
      const raw = item?.value != null ? String(item.value).trim() : "";
      union.add(raw === "" ? "(vacío)" : raw);
    }
  }
  const names = Array.from(union).sort((a, b) => a.localeCompare(b, "es"));
  const data = names.map((name) => {
    const row: Record<string, string | number> = { name };
    fieldKeys.forEach((fieldKey, i) => {
      let n = 0;
      for (const wo of workOrders) {
        if (!analyticsEligibleWo(wo)) continue;
        const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
        const raw = item?.value != null ? String(item.value).trim() : "";
        const cmp = raw === "" ? "(vacío)" : raw;
        if (cmp === name) n++;
      }
      row[`c${i}`] = n;
    });
    return row;
  });
  return { data, series };
}
