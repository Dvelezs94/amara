import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceSchedules, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import {
  buildRecurrenceJson,
  expandOccurrencesInRange,
  parseRecurrence,
  parseYmdToLocalDate,
} from "@/lib/maintenance-recurrence";

function isMissingAssigneeColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.assignee_id") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db
    .select({ id: maintenanceSchedules.id, name: maintenanceSchedules.name })
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.assigneeId !== undefined) {
    const assigneeId =
      body.assigneeId === null || body.assigneeId === ""
        ? null
        : String(body.assigneeId);
    if (assigneeId) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, assigneeId),
      });
      if (!u) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 400 }
        );
      }
    }
    try {
      await db
        .update(maintenanceSchedules)
        .set({ assigneeId })
        .where(eq(maintenanceSchedules.id, id));
    } catch (error) {
      if (!isMissingAssigneeColumnError(error)) throw error;
      return NextResponse.json(
        {
          error:
            "No se puede actualizar el responsable porque falta la columna assignee_id en maintenance_schedules.",
        },
        { status: 409 }
      );
    }

    await recordAuditLog({
      entityType: "maintenance_schedule",
      entityId: id,
      action: "assignee_updated",
      userId: session.id,
      metadata: {
        scheduleName: row.name,
        after: { assigneeId },
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db.query.maintenanceSchedules.findFirst({
    where: eq(maintenanceSchedules.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const date = url.searchParams.get("date");

  if (scope === "single" && date) {
    const rule = parseRecurrence(row.recurrence);
    if (!rule || rule.frequency === "none") {
      await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
      return NextResponse.json({ ok: true, deleted: "single-as-series" });
    }

    const excluded = new Set(rule.excludedDates ?? []);
    excluded.add(date);
    const nextRule = { ...rule, excludedDates: Array.from(excluded) };
    const recurrence = buildRecurrenceJson(nextRule);

    const probeStart = parseYmdToLocalDate(date);
    const probeEnd = new Date(probeStart);
    probeEnd.setFullYear(probeEnd.getFullYear() + 5);
    const next = expandOccurrencesInRange(nextRule, probeStart, probeEnd)[0] ?? null;

    await db
      .update(maintenanceSchedules)
      .set({ recurrence, nextRunAt: next })
      .where(eq(maintenanceSchedules.id, id));

    await recordAuditLog({
      entityType: "maintenance_schedule",
      entityId: id,
      action: "occurrence_deleted",
      userId: session.id,
      metadata: {
        scheduleName: row.name,
        date,
      },
    });

    return NextResponse.json({ ok: true, deleted: "single" });
  }

  await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "deleted",
    userId: session.id,
    metadata: { scheduleName: row.name },
  });
  return NextResponse.json({ ok: true, deleted: "all" });
}
