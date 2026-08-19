import {
  parseYmdToLocalDate,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";

export type SeedChecklistItemType =
  | "step"
  | "custom_field"
  | "text_block"
  | "section";

export type SeedChecklistFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "photo"
  | "title"
  | "subtitle"
  | "paragraph";

export type SeedChecklistItemDef = {
  type: SeedChecklistItemType;
  label: string;
  fieldType?: SeedChecklistFieldType;
  options?: string[];
  isOptional?: boolean;
  /** Local key used to nest children via `parentKey`. */
  key?: string;
  parentKey?: string;
};

export type SeedChecklistItemRow = SeedChecklistItemDef & {
  id: string;
  parentItemId: string | null;
};

/** Shift a YYYY-MM-DD calendar date by a number of days (local timezone). */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const d = parseYmdToLocalDate(ymd);
  d.setDate(d.getDate() + days);
  return toYmdLocal(d);
}

export function dateFromYmdAtHour(ymd: string, hour = 8): Date {
  const d = parseYmdToLocalDate(ymd);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Assign stable ids and resolve `parentKey` → `parentItemId` for nested checklist rows. */
export function assignSeedChecklistItemIds(
  items: SeedChecklistItemDef[],
  newId: () => string
): SeedChecklistItemRow[] {
  const keyToId = new Map<string, string>();
  const rows: SeedChecklistItemRow[] = items.map((item) => {
    const id = newId();
    if (item.key) keyToId.set(item.key, id);
    return { ...item, id, parentItemId: null };
  });
  for (const row of rows) {
    if (!row.parentKey) continue;
    row.parentItemId = keyToId.get(row.parentKey) ?? null;
  }
  return rows;
}

export function seedChecklistItemCompleted(input: {
  type: string;
  status: string;
  sortOrder: number;
}): boolean {
  if (input.type !== "step") return false;
  if (input.status === "completed") return true;
  if (input.status === "in_progress") return input.sortOrder < 2;
  return false;
}
