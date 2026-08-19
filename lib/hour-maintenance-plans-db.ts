import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assetHourMaintenancePlans,
  calendars,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { ensureDefaultCalendar } from "@/lib/ensure-default-calendar";
import type { ParsedHourMaintenancePlanFields } from "@/lib/hour-maintenance";

export async function deleteHourPlansForScheduleId(
  scheduleId: string
): Promise<void> {
  await db
    .delete(assetHourMaintenancePlans)
    .where(eq(assetHourMaintenancePlans.scheduleId, scheduleId));
}

export async function resolveHourPlanRelations(
  fields: ParsedHourMaintenancePlanFields
): Promise<
  | {
      ok: true;
      calendarId: string;
      checklistTemplateId: string | null;
      assigneeIds: string[];
    }
  | { ok: false; error: string }
> {
  let calendarId = fields.calendarId;
  if (calendarId) {
    const cal = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { id: true },
    });
    if (!cal) return { ok: false, error: "Calendario no encontrado" };
  } else {
    calendarId = await ensureDefaultCalendar();
  }

  let checklistTemplateId = fields.checklistTemplateId;
  if (checklistTemplateId) {
    const t = await db.query.checklistTemplates.findFirst({
      where: eq(checklistTemplates.id, checklistTemplateId),
    });
    if (!t) {
      return { ok: false, error: "Plantilla de checklist no encontrada" };
    }
  }

  for (const uid of fields.assigneeIds) {
    const u = await db.query.users.findFirst({
      where: eq(users.id, uid),
      columns: { id: true },
    });
    if (!u) return { ok: false, error: "Usuario no encontrado" };
  }

  return {
    ok: true,
    calendarId,
    checklistTemplateId,
    assigneeIds: fields.assigneeIds,
  };
}
