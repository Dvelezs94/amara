/**
 * Build datasets for analytics when several checklist fields share the same `fieldType`.
 */

export type ChecklistRow = {
  label: string;
  type: string;
  fieldType: string | null;
  value: unknown;
};

export type WoChecklistRow = {
  completedAt: string | null;
  checklistItems: ChecklistRow[];
};

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

export function fieldTypeForLabel(
  workOrders: WoChecklistRow[],
  label: string
): string | null {
  for (const wo of workOrders) {
    const it = wo.checklistItems.find(
      (i) => i.label === label && i.type === "custom_field"
    );
    if (it?.fieldType) return it.fieldType;
  }
  return null;
}

/** Returns shared type if all selected labels resolve to the same `fieldType`; otherwise null. */
export function commonFieldType(
  workOrders: WoChecklistRow[],
  labels: string[]
): string | null {
  if (!labels.length) return null;
  const types = labels.map((l) => fieldTypeForLabel(workOrders, l));
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

export function buildMultiNumberTimeData(
  workOrders: WoChecklistRow[],
  labels: string[],
  timeZone: string
): { data: Record<string, string | number | null>[]; series: { key: string; name: string }[] } {
  const series = labels.map((name, i) => ({ key: seriesKeyAt(i), name }));
  const rows: Record<string, string | number | null>[] = [];
  for (const wo of workOrders) {
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
    labels.forEach((label, i) => {
      const item = wo.checklistItems.find((x) => x.label === label);
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
  labels: string[]
): { name: string; sí: number; no: number }[] {
  return labels.map((label) => {
    let sí = 0;
    let no = 0;
    for (const wo of workOrders) {
      const item = wo.checklistItems.find((x) => x.label === label);
      if (!item) continue;
      if (item.value === true) sí++;
      else no++;
    }
    const short = label.length > 28 ? `${label.slice(0, 26)}…` : label;
    return { name: short, sí, no };
  });
}

/** Union of category labels across fields; one bar group per category with one bar per field. */
export function buildMultiCategoricalUnion(
  workOrders: WoChecklistRow[],
  labels: string[]
): { data: Record<string, string | number>[]; series: { key: string; name: string }[] } {
  const series = labels.map((name, i) => ({ key: `c${i}`, name }));
  const union = new Set<string>();
  for (const label of labels) {
    for (const wo of workOrders) {
      const item = wo.checklistItems.find((x) => x.label === label);
      const raw = item?.value != null ? String(item.value).trim() : "";
      union.add(raw === "" ? "(vacío)" : raw);
    }
  }
  const names = Array.from(union).sort((a, b) => a.localeCompare(b, "es"));
  const data = names.map((name) => {
    const row: Record<string, string | number> = { name };
    labels.forEach((label, i) => {
      let n = 0;
      for (const wo of workOrders) {
        const item = wo.checklistItems.find((x) => x.label === label);
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
