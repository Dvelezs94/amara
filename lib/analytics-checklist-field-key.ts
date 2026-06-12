/**
 * Stable keys for checklist analytics fields, disambiguated by section path.
 */

import { flattenChecklistTreeForDisplay } from "@/lib/checklist-item-tree";

export type AnalyticsChecklistTreeItem = {
  id: string;
  label: string;
  type: string;
  parentItemId?: string | null;
  sortOrder?: number;
};

export type AnalyticsFieldDescriptor = {
  /** Unique key used for selection, storage, and chart matching. */
  key: string;
  label: string;
  /** Section breadcrumb (ancestor section labels), or null when root-level. */
  sectionLabel: string | null;
  /** Human-readable label for UI and chart legends. */
  displayLabel: string;
};

const FIELD_KEY_SEP = " › ";

/** Build a stable key from section path + field label. */
export function analyticsFieldKey(sectionPath: readonly string[], label: string): string {
  const trimmed = label.trim();
  if (!sectionPath.length) return trimmed;
  return `${sectionPath.join(" / ")}${FIELD_KEY_SEP}${trimmed}`;
}

/** Walk `parentItemId` links and collect ancestor section labels (root → leaf). */
export function resolveSectionPath(
  item: { parentItemId?: string | null },
  allItems: readonly AnalyticsChecklistTreeItem[]
): string[] {
  const path: string[] = [];
  let parentId: string | null | undefined = item.parentItemId ?? null;
  while (parentId) {
    const parent = allItems.find((x) => x.id === parentId);
    if (!parent) break;
    if (parent.type === "section") {
      path.unshift(parent.label.trim() || "Sección");
    }
    parentId = parent.parentItemId ?? null;
  }
  return path;
}

export function buildAnalyticsFieldDescriptor(
  item: AnalyticsChecklistTreeItem,
  allItems: readonly AnalyticsChecklistTreeItem[]
): AnalyticsFieldDescriptor {
  const sectionPath = resolveSectionPath(item, allItems);
  const label = item.label.trim();
  const key = analyticsFieldKey(sectionPath, label);
  return {
    key,
    label,
    sectionLabel: sectionPath.length > 0 ? sectionPath.join(" / ") : null,
    displayLabel: key,
  };
}

export function buildAnalyticsFieldDescriptors(
  workOrders: { checklistItems: AnalyticsChecklistTreeItem[] }[]
): AnalyticsFieldDescriptor[] {
  const seen = new Map<string, AnalyticsFieldDescriptor>();
  const order: string[] = [];

  const addFromItems = (items: readonly AnalyticsChecklistTreeItem[]) => {
    const flat = flattenChecklistTreeForDisplay(items);
    for (const it of flat) {
      if (it.type !== "custom_field" || !it.label?.trim()) continue;
      const descriptor = buildAnalyticsFieldDescriptor(it, items);
      if (!seen.has(descriptor.key)) {
        seen.set(descriptor.key, descriptor);
        order.push(descriptor.key);
      }
    }
  };

  for (const wo of workOrders) {
    addFromItems(wo.checklistItems);
  }

  return order.map((key) => seen.get(key)!);
}

/** Match a stored field key (or legacy plain label) to a checklist row. */
export function findChecklistItemByFieldKey<
  T extends AnalyticsChecklistTreeItem & { type: string },
>(items: readonly T[], fieldKey: string): T | undefined {
  const trimmedKey = fieldKey.trim();
  if (!trimmedKey) return undefined;

  for (const it of items) {
    if (it.type !== "custom_field") continue;
    const sectionPath = resolveSectionPath(it, items);
    if (analyticsFieldKey(sectionPath, it.label) === trimmedKey) return it;
  }

  // Legacy widgets may store only the bare field label.
  if (!trimmedKey.includes(FIELD_KEY_SEP)) {
    const matches = items.filter(
      (i) => i.type === "custom_field" && i.label.trim() === trimmedKey
    );
    if (matches.length === 1) return matches[0];
  }

  return undefined;
}

export function displayLabelForFieldKey(
  workOrders: { checklistItems: AnalyticsChecklistTreeItem[] }[],
  fieldKey: string
): string {
  for (const wo of workOrders) {
    const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
    if (item) {
      return buildAnalyticsFieldDescriptor(item, wo.checklistItems).displayLabel;
    }
  }
  return fieldKey;
}
