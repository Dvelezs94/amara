import { and, gte, like, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import {
  dayBoundsFromYmd,
  maintenanceScheduleWorkOrderDescriptionPattern,
} from "@/lib/maintenance-schedule-work-order";

export async function workOrderExistsForScheduleDay(
  scheduleId: string,
  dateYmd: string
): Promise<boolean> {
  const bounds = dayBoundsFromYmd(dateYmd);
  if (!bounds) return false;
  const existing = await db.query.workOrders.findFirst({
    where: and(
      like(
        workOrders.description,
        maintenanceScheduleWorkOrderDescriptionPattern(scheduleId)
      ),
      gte(workOrders.dueDate, bounds.start),
      lte(workOrders.dueDate, bounds.end)
    ),
    columns: { id: true },
  });
  return existing != null;
}
