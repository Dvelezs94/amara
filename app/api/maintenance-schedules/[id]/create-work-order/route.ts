import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { setWorkOrderAssigneeIds } from "@/lib/assignees";
import { copyChecklistTemplateItemsToWorkOrder } from "@/lib/copy-checklist-template-to-work-order";
import { maintenanceSchedules, users, workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { recordAuditLog } from "@/lib/audit";

function parseYmd(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(
  req: Request,
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
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const dueDate = parseYmd(body?.dateYmd) ?? schedule.nextRunAt ?? null;
  let assigneeIds: string[] = [];
  if (Array.isArray(body?.assigneeIds)) {
    assigneeIds = Array.from(
      new Set(
        body.assigneeIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      )
    );
  } else if (typeof body?.assigneeId === "string" && body.assigneeId.trim()) {
    assigneeIds = [body.assigneeId.trim()];
  }
  if (assigneeIds.length === 0) {
    return NextResponse.json(
      { error: "Debes seleccionar al menos un responsable" },
      { status: 400 }
    );
  }
  for (const aid of assigneeIds) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.id, aid),
      columns: { id: true },
    });
    if (!assignee) {
      return NextResponse.json(
        { error: "Responsable no encontrado" },
        { status: 400 }
      );
    }
  }
  const assigneeId = assigneeIds[0]!;

  const workOrderId = createId();
  const folio = await getNextWorkOrderFolio();
  const now = new Date();

  await db.insert(workOrders).values({
    id: workOrderId,
    folio,
    title: schedule.name,
    description: `Generada desde calendario de mantenimiento (${schedule.id}).`,
    status: "pending",
    priority: "medium",
    kind: "routine",
    assetId: schedule.assetId ?? null,
    assigneeId,
    requesterId: session.id,
    dueDate,
    createdAt: now,
    updatedAt: now,
  });

  await setWorkOrderAssigneeIds(workOrderId, assigneeIds);

  if (schedule.checklistTemplateId) {
    await copyChecklistTemplateItemsToWorkOrder({
      workOrderId,
      checklistTemplateId: schedule.checklistTemplateId,
      newId: createId,
    });
  }

  await recordAuditLog({
    entityType: "work_order",
    entityId: workOrderId,
    action: "created_from_schedule",
    userId: session.id,
    metadata: {
      scheduleId: schedule.id,
      checklistTemplateId: schedule.checklistTemplateId ?? null,
      dueDate: dueDate ? dueDate.toISOString() : null,
    },
  });

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: schedule.id,
    action: "work_order_created",
    userId: session.id,
    metadata: {
      workOrderId,
      folio,
    },
  });

  return NextResponse.json({ id: workOrderId, folio });
}
