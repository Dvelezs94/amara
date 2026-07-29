import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canEditLockedWorkOrderChecklist } from "@/lib/auth-shared";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { parseWorkOrderChecklistPatchBody } from "@/lib/work-order-checklist-patch";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: workOrderId } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
  });
  if (!wo) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }
  if (
    (wo.status === "completed" || wo.status === "cancelled") &&
    !canEditLockedWorkOrderChecklist(session.role)
  ) {
    return NextResponse.json(
      { error: "No se puede modificar el checklist de una orden cerrada" },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const itemId = createId();
  await db.insert(workOrderChecklist).values({
    id: itemId,
    workOrderId,
    type: body.type ?? "step",
    label: (body.label ?? "").trim() || "Step",
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    completed: false,
    fieldType: body.fieldType ?? null,
    options: body.options ?? null,
  });
  await recordAuditLog({
    entityType: "work_order_checklist",
    entityId: itemId,
    action: "created",
    userId: session.id,
    metadata: {
      workOrderId,
      type: body.type ?? "step",
      label: (body.label ?? "").trim() || "Step",
      sortOrder:
        typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  });
  return NextResponse.json({ id: itemId });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: workOrderId } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
  });
  if (!wo) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }
  if (
    (wo.status === "completed" || wo.status === "cancelled") &&
    !canEditLockedWorkOrderChecklist(session.role)
  ) {
    return NextResponse.json(
      { error: "No se puede modificar el checklist de una orden cerrada" },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));

  // Peek item for field-type normalization (and 404 / no-op section).
  const itemIdEarly =
    typeof (body as { itemId?: unknown }).itemId === "string"
      ? String((body as { itemId: string }).itemId).trim()
      : "";
  if (!itemIdEarly) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }
  const before = await db.query.workOrderChecklist.findFirst({
    where: and(
      eq(workOrderChecklist.id, itemIdEarly),
      eq(workOrderChecklist.workOrderId, workOrderId)
    ),
  });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (before.type === "section" || before.type === "text_block") {
    return NextResponse.json({ ok: true });
  }

  const parsed = parseWorkOrderChecklistPatchBody(body, {
    type: before.type,
    fieldType: before.fieldType,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { itemId, updates } = parsed;

  await db
    .update(workOrderChecklist)
    .set(updates as Record<string, unknown>)
    .where(
      and(
        eq(workOrderChecklist.id, itemId),
        eq(workOrderChecklist.workOrderId, workOrderId)
      )
    );

  await recordAuditLog({
    entityType: "work_order_checklist",
    entityId: itemId,
    action: "updated",
    userId: session.id,
    metadata: {
      workOrderId,
      before: {
        completed: before.completed,
        value: before.value,
      },
      after: {
        completed:
          updates.completed !== undefined ? updates.completed : before.completed,
        value: updates.value !== undefined ? updates.value : before.value,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
