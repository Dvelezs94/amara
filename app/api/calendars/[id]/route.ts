import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendars, maintenanceSchedules } from "@/lib/db/schema";
import {
  DEFAULT_CALENDAR_NAME,
  isDefaultCalendarId,
} from "@/lib/calendar-helpers";
import { ensureDefaultCalendar } from "@/lib/ensure-default-calendar";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const row = await db.query.calendars.findFirst({
    where: eq(calendars.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: {
    name?: string;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const nextName = String(body.name).trim();
    if (isDefaultCalendarId(id) && nextName !== DEFAULT_CALENDAR_NAME) {
      return NextResponse.json(
        { error: "No se puede renombrar el calendario Mantenimiento" },
        { status: 400 }
      );
    }
    if (nextName && nextName !== row.name) updates.name = nextName;
  }
  if (body.sortOrder !== undefined && typeof body.sortOrder === "number") {
    updates.sortOrder = body.sortOrder;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(calendars).set(updates).where(eq(calendars.id, id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (isDefaultCalendarId(id)) {
    return NextResponse.json(
      { error: "No se puede eliminar el calendario Mantenimiento" },
      { status: 400 }
    );
  }
  const row = await db.query.calendars.findFirst({
    where: eq(calendars.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const defaultId = await ensureDefaultCalendar();
  await db
    .update(maintenanceSchedules)
    .set({ calendarId: defaultId })
    .where(eq(maintenanceSchedules.calendarId, id));
  await db.delete(calendars).where(eq(calendars.id, id));
  return NextResponse.json({ ok: true });
}
