import { parseDatetimeLocalValue } from "@/lib/datetime-local";
import { isValidYmd } from "@/lib/dashboard-date-range";
import { checklistItemBlocksWorkOrderCompletion } from "@/lib/checklist-completion";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { ymdInTimeZone } from "@/lib/work-order-start-date";

export type DashboardChecklistItemInput = {
  type: string;
  fieldType?: string | null;
  value: unknown;
  completed?: boolean | null;
  isOptional?: boolean | null;
};

export type DashboardChecklistRow = DashboardChecklistItemInput & {
  workOrderId: string;
  checklistTemplateId?: string | null;
};

export type DashboardChecklistGroup = {
  workOrderId: string;
  checklistTemplateId: string | null;
  completedCount: number;
  totalCount: number;
  isPriority: boolean;
};

const NO_OK_RE = /no\s*ok/i;

function checklistItemValueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function checklistDropdownValueIsNoOk(value: unknown): boolean {
  return NO_OK_RE.test(checklistItemValueText(value));
}

export function isChecklistPriority(
  items: readonly DashboardChecklistItemInput[],
  hasNotes: boolean
): boolean {
  if (hasNotes) return true;
  return items.some(
    (item) =>
      item.type === "custom_field" &&
      item.fieldType === "dropdown" &&
      checklistDropdownValueIsNoOk(item.value)
  );
}

function isTrackableChecklistItem(item: DashboardChecklistItemInput): boolean {
  return item.type === "step" || item.type === "custom_field";
}

function isChecklistItemComplete(item: DashboardChecklistItemInput): boolean {
  if (item.type === "step") return item.completed === true;
  if (item.type === "custom_field") {
    return !checklistItemBlocksWorkOrderCompletion({
      type: item.type,
      completed: item.completed,
      fieldType: item.fieldType,
      value: item.value,
      isOptional: item.isOptional,
    });
  }
  return false;
}

export function countChecklistProgress(items: readonly DashboardChecklistItemInput[]): {
  completedCount: number;
  totalCount: number;
} {
  const trackable = items.filter(isTrackableChecklistItem);
  const completedCount = trackable.filter(isChecklistItemComplete).length;
  return { completedCount, totalCount: trackable.length };
}

export function groupChecklistsByWorkOrder(
  rows: readonly DashboardChecklistRow[],
  workOrderHasNotes: Readonly<Record<string, boolean>> = {}
): DashboardChecklistGroup[] {
  const byWorkOrder = new Map<string, DashboardChecklistItemInput[]>();
  const templateByWorkOrder = new Map<string, string | null>();

  for (const row of rows) {
    const items = byWorkOrder.get(row.workOrderId) ?? [];
    items.push({
      type: row.type,
      fieldType: row.fieldType,
      value: row.value,
      completed: row.completed,
      isOptional: row.isOptional,
    });
    byWorkOrder.set(row.workOrderId, items);
    if (!templateByWorkOrder.has(row.workOrderId) && row.checklistTemplateId) {
      templateByWorkOrder.set(row.workOrderId, row.checklistTemplateId);
    }
  }

  return Array.from(byWorkOrder.entries()).map(([workOrderId, items]) => {
    const { completedCount, totalCount } = countChecklistProgress(items);
    const hasNotes = workOrderHasNotes[workOrderId] === true;
    return {
      workOrderId,
      checklistTemplateId: templateByWorkOrder.get(workOrderId) ?? null,
      completedCount,
      totalCount,
      isPriority: isChecklistPriority(items, hasNotes),
    };
  });
}

export function todayYmdInAppTimeZone(now = new Date()): string {
  return ymdInTimeZone(now, APP_TIME_ZONE);
}

export function shiftYmd(ymd: string, deltaDays: number): string | null {
  if (!isValidYmd(ymd)) return null;
  const anchor = parseDatetimeLocalValue(`${ymd}T12:00`, APP_TIME_ZONE);
  if (!anchor) return null;
  const shifted = new Date(anchor.getTime() + deltaDays * 86_400_000);
  return ymdInTimeZone(shifted, APP_TIME_ZONE);
}

/** Inclusive calendar-day bounds in the app timezone (America/Monterrey). */
export function dayBoundsInAppTimeZone(ymd: string): { start: Date; end: Date } | null {
  if (!isValidYmd(ymd)) return null;
  const start = parseDatetimeLocalValue(`${ymd}T00:00`, APP_TIME_ZONE);
  const nextYmd = shiftYmd(ymd, 1);
  const nextStart = nextYmd
    ? parseDatetimeLocalValue(`${nextYmd}T00:00`, APP_TIME_ZONE)
    : null;
  if (!start || !nextStart) return null;
  return { start, end: new Date(nextStart.getTime() - 1) };
}
