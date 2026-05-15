import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { auditLogs, maintenanceSchedules } from "@/lib/db/schema";

const REVERSIBLE_ACTIONS = ["occurrence_deleted", "series_future_truncated"] as const;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const schedule = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(maintenanceSchedules.id, id),
      isNull(maintenanceSchedules.deletedAt)
    ),
  });
  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "maintenance_schedule"),
        eq(auditLogs.entityId, id),
        inArray(auditLogs.action, [...REVERSIBLE_ACTIONS])
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const entry = entries[0];
  const meta = entry?.metadata as
    | {
        beforeRecurrence?: string;
        beforeNextRunAt?: string | null;
      }
    | undefined;

  if (!entry || !meta?.beforeRecurrence) {
    return NextResponse.json(
      { error: "No hay cambio de repetición reciente que deshacer" },
      { status: 400 }
    );
  }

  await db
    .update(maintenanceSchedules)
    .set({
      recurrence: meta.beforeRecurrence,
      nextRunAt: meta.beforeNextRunAt
        ? new Date(meta.beforeNextRunAt)
        : null,
    })
    .where(eq(maintenanceSchedules.id, id));

  await db.delete(auditLogs).where(eq(auditLogs.id, entry.id));

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "recurrence_undone",
    userId: session.id,
    metadata: {
      scheduleName: schedule.name,
      undoneAuditLogId: entry.id,
      undoneAction: entry.action,
    },
  });

  return NextResponse.json({ ok: true });
}
