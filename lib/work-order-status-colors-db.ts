import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  parseWorkOrderStatusColors,
  WORK_ORDER_STATUS_COLOR_SETTINGS_KEY,
  type WorkOrderStatusColors,
} from "@/lib/work-order-status-colors";

export async function getWorkOrderStatusColors(): Promise<WorkOrderStatusColors> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, WORK_ORDER_STATUS_COLOR_SETTINGS_KEY),
    columns: { value: true },
  });
  return parseWorkOrderStatusColors(row?.value) ?? DEFAULT_WORK_ORDER_STATUS_COLORS;
}

export async function saveWorkOrderStatusColors(
  colors: WorkOrderStatusColors
): Promise<void> {
  const now = new Date();
  await db
    .insert(appSettings)
    .values({
      key: WORK_ORDER_STATUS_COLOR_SETTINGS_KEY,
      value: colors,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: colors, updatedAt: now },
    });
}
