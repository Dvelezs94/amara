import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  calendars,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { setMaintenanceScheduleAssigneeIds } from "@/lib/assignees";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { parseRecurrencePayloadFromMaintenanceBody } from "@/lib/maintenance-schedule-recurrence-from-request";
import { ensureDefaultCalendar } from "@/lib/ensure-default-calendar";

function isMissingAssigneeColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.assignee_id") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

function isMissingColorColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.color") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const parsedRec = parseRecurrencePayloadFromMaintenanceBody(
    body as Record<string, unknown>
  );
  if (!parsedRec.ok) {
    return NextResponse.json({ error: parsedRec.error }, { status: 400 });
  }
  const { recurrence, nextRunAt, rule } = parsedRec;

  const assetId =
    body.assetId != null && body.assetId !== ""
      ? String(body.assetId)
      : null;
  if (assetId) {
    const a = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    if (!a) {
      return NextResponse.json({ error: "Activo no encontrado" }, { status: 400 });
    }
  }

  let assigneeIds: string[] = [];
  if (Array.isArray(body.assigneeIds)) {
    assigneeIds = Array.from(
      new Set(
        body.assigneeIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      )
    );
  } else if (
    body.assigneeId != null &&
    body.assigneeId !== ""
  ) {
    assigneeIds = [String(body.assigneeId)];
  }
  const assigneeId = assigneeIds[0] ?? null;
  for (const uid of assigneeIds) {
    const u = await db.query.users.findFirst({
      where: eq(users.id, uid),
      columns: { id: true },
    });
    if (!u) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 400 }
      );
    }
  }

  const colorRaw = typeof body.color === "string" ? body.color.trim().toUpperCase() : "";
  const color = /^#[0-9A-F]{6}$/.test(colorRaw) ? colorRaw : "#02257D";

  let checklistTemplateId: string | null =
    body.checklistTemplateId != null && body.checklistTemplateId !== ""
      ? String(body.checklistTemplateId)
      : null;
  if (checklistTemplateId) {
    const t = await db.query.checklistTemplates.findFirst({
      where: eq(checklistTemplates.id, checklistTemplateId),
    });
    if (!t) {
      return NextResponse.json(
        { error: "Plantilla de checklist no encontrada" },
        { status: 400 }
      );
    }
  }

  let calendarId: string | null =
    body.calendarId != null && body.calendarId !== ""
      ? String(body.calendarId)
      : null;
  if (calendarId) {
    const cal = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { id: true },
    });
    if (!cal) {
      return NextResponse.json(
        { error: "Calendario no encontrado" },
        { status: 400 }
      );
    }
  } else {
    calendarId = await ensureDefaultCalendar();
  }

  const id = createId();
  try {
    await db.insert(maintenanceSchedules).values({
      id,
      name,
      assetId,
      assigneeId,
      color,
      checklistTemplateId,
      calendarId,
      recurrence,
      nextRunAt,
    });
  } catch (error) {
    if (!isMissingAssigneeColumnError(error) && !isMissingColorColumnError(error)) {
      throw error;
    }
    const values: {
      id: string;
      name: string;
      assetId: string | null;
      checklistTemplateId: string | null;
      calendarId?: string | null;
      recurrence: string;
      nextRunAt: Date;
      assigneeId?: string | null;
      color?: string;
    } = {
      id,
      name,
      assetId,
      checklistTemplateId,
      calendarId,
      recurrence,
      nextRunAt,
    };
    if (!isMissingAssigneeColumnError(error)) values.assigneeId = assigneeId;
    if (!isMissingColorColumnError(error)) values.color = color;
    await db.insert(maintenanceSchedules).values(values);
  }

  await setMaintenanceScheduleAssigneeIds(id, assigneeIds);

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: {
      name,
      recurrence: rule,
      nextRunAt: nextRunAt.toISOString(),
    },
  });

  return NextResponse.json({
    id,
    nextRunAt: nextRunAt.toISOString(),
  });
}
