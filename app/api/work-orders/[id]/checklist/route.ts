import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";

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
  if (wo.status === "completed") {
    return NextResponse.json(
      { error: "No se puede modificar el checklist de una orden completada" },
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
  if (wo.status === "completed") {
    return NextResponse.json(
      { error: "No se puede modificar el checklist de una orden completada" },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const itemId = body.itemId;
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (body.completed !== undefined) updates.completed = body.completed;
  if (body.value !== undefined) updates.value = body.value;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }
  const before = await db.query.workOrderChecklist.findFirst({
    where: and(
      eq(workOrderChecklist.id, itemId),
      eq(workOrderChecklist.workOrderId, workOrderId)
    ),
  });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (before.type === "section" || before.type === "text_block") {
    return NextResponse.json({ ok: true });
  }

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
      before: before
        ? {
            completed: before.completed,
            value: before.value,
          }
        : null,
      after: {
        completed:
          body.completed !== undefined
            ? body.completed
            : before?.completed,
        value:
          body.value !== undefined ? body.value : before?.value,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
