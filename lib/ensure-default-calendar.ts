import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendars, maintenanceSchedules } from "@/lib/db/schema";
import {
  DEFAULT_CALENDAR_ID,
  DEFAULT_CALENDAR_NAME,
} from "@/lib/calendar-helpers";

/** Ensure the built-in Mantenimiento calendar exists; return its id. */
export async function ensureDefaultCalendar(): Promise<string> {
  const existing = await db.query.calendars.findFirst({
    where: eq(calendars.id, DEFAULT_CALENDAR_ID),
    columns: { id: true },
  });
  if (existing) return existing.id;

  await db.insert(calendars).values({
    id: DEFAULT_CALENDAR_ID,
    name: DEFAULT_CALENDAR_NAME,
    sortOrder: 0,
  });
  return DEFAULT_CALENDAR_ID;
}

/** Assign any schedules missing a calendar to Mantenimiento. */
export async function assignOrphanSchedulesToDefaultCalendar(): Promise<void> {
  await ensureDefaultCalendar();
  await db
    .update(maintenanceSchedules)
    .set({ calendarId: DEFAULT_CALENDAR_ID })
    .where(isNull(maintenanceSchedules.calendarId));
}
