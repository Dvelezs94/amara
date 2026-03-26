import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { notes } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [asset, assignee, requester] = await Promise.all([
    wo.assetId
      ? db.query.assets.findFirst({ where: eq(assets.id, wo.assetId) })
      : null,
    wo.assigneeId
      ? db.query.users.findFirst({
          where: eq(users.id, wo.assigneeId!),
          columns: { id: true, name: true, email: true },
        })
      : null,
    wo.requesterId
      ? db.query.users.findFirst({
          where: eq(users.id, wo.requesterId),
          columns: { id: true, name: true },
        })
      : null,
  ]);
  const checklist = await db.query.workOrderChecklist.findMany({
    where: eq(workOrderChecklist.workOrderId, id),
    orderBy: (items, { asc }) => [asc(items.sortOrder)],
  });
  const noteList = await db.query.notes.findMany({
    where: eq(notes.workOrderId, id),
  });
  const attachmentList = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, id),
    orderBy: [desc(attachments.createdAt)],
  });
  return NextResponse.json({
    ...wo,
    asset: asset
      ? { id: asset.id, name: asset.name, assetId: asset.assetId }
      : null,
    assignee: assignee ?? null,
    requester: requester ?? null,
    checklist,
    notes: noteList,
    attachments: attachmentList,
  });
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
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (wo.status === "completed") {
    return NextResponse.json(
      { error: "No se puede modificar una orden completada" },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  if (body.assigneeId !== undefined && session.role !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores pueden cambiar el asignado" },
      { status: 403 }
    );
  }
  const updates: Partial<typeof workOrders.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() ?? null;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assetId !== undefined) updates.assetId = body.assetId || null;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId || null;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  const isCompleting = body.status === "completed";
  if (body.status === "completed") updates.completedAt = new Date();

  await db.update(workOrders).set(updates).where(eq(workOrders.id, id));

  const nextAssigneeId =
    body.assigneeId !== undefined ? body.assigneeId || null : wo.assigneeId;
  const assigneeChanged = body.assigneeId !== undefined && nextAssigneeId !== wo.assigneeId;
  if (assigneeChanged && nextAssigneeId && nextAssigneeId !== session.id) {
    await createNotification({
      userId: nextAssigneeId,
      type: "assignment",
      title: "Nueva orden asignada",
      body: wo.title,
      workOrderId: id,
    });
  }
  if (!assigneeChanged && nextAssigneeId && nextAssigneeId !== session.id) {
    await createNotification({
      userId: nextAssigneeId,
      type: "work_order_update",
      title: "Actualización en orden asignada",
      body: wo.title,
      workOrderId: id,
    });
  }

  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: isCompleting ? "completed" : "updated",
    userId: session.id,
    metadata: {
      before: {
        status: wo.status,
        priority: wo.priority,
        assigneeId: wo.assigneeId,
        dueDate: wo.dueDate,
      },
      after: {
        status: body.status ?? wo.status,
        priority: body.priority ?? wo.priority,
        assigneeId: body.assigneeId ?? wo.assigneeId,
        dueDate:
          body.dueDate !== undefined ? body.dueDate : wo.dueDate,
      },
    },
  });

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
  const { id } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  await db.delete(workOrders).where(eq(workOrders.id, id));
  if (wo) {
    await recordAuditLog({
      entityType: "work_order",
      entityId: id,
      action: "deleted",
      userId: session.id,
      metadata: {
        title: wo.title,
        status: wo.status,
        assetId: wo.assetId,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
