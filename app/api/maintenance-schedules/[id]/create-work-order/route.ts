import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checklistTemplateItems,
  maintenanceSchedules,
  users,
  workOrderChecklist,
  workOrders,
} from "@/lib/db/schema";
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
    where: eq(maintenanceSchedules.id, id),
  });
  if (!schedule) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const dueDate = parseYmd(body?.dateYmd) ?? schedule.nextRunAt ?? null;
  const assigneeId =
    typeof body?.assigneeId === "string" ? body.assigneeId.trim() : "";
  if (!assigneeId) {
    return NextResponse.json(
      { error: "Debes seleccionar un responsable" },
      { status: 400 }
    );
  }
  const assignee = await db.query.users.findFirst({
    where: eq(users.id, assigneeId),
    columns: { id: true },
  });
  if (!assignee) {
    return NextResponse.json(
      { error: "Responsable no encontrado" },
      { status: 400 }
    );
  }

  const workOrderId = createId();
  const folio = await getNextWorkOrderFolio();
  const now = new Date();

  await db.insert(workOrders).values({
    id: workOrderId,
    folio,
    title: schedule.name,
    description: `Generada desde calendario de mantenimiento (${schedule.id}).`,
    status: "open",
    priority: "medium",
    kind: "routine",
    assetId: schedule.assetId ?? null,
    assigneeId,
    requesterId: session.id,
    dueDate,
    createdAt: now,
    updatedAt: now,
  });

  if (schedule.checklistTemplateId) {
    const templateItems = await db.query.checklistTemplateItems.findMany({
      where: eq(
        checklistTemplateItems.checklistTemplateId,
        schedule.checklistTemplateId
      ),
      orderBy: (items, { asc }) => [asc(items.sortOrder)],
    });
    for (const item of templateItems) {
      await db.insert(workOrderChecklist).values({
        id: createId(),
        workOrderId,
        checklistTemplateId: schedule.checklistTemplateId,
        type: item.type,
        label: item.label,
        sortOrder: item.sortOrder,
        completed: false,
        fieldType: item.fieldType,
        options: item.options,
      });
    }
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
