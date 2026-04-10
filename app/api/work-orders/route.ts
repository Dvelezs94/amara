import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { createNotification } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assigneeId = searchParams.get("assigneeId");

  const conditions = [];
  if (status) conditions.push(eq(workOrders.status, status as "open" | "in_progress" | "completed" | "cancelled"));
  if (assigneeId) conditions.push(eq(workOrders.assigneeId, assigneeId));

  const base = db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueDate: workOrders.dueDate,
      completedAt: workOrders.completedAt,
      startedAt: workOrders.startedAt,
      kind: workOrders.kind,
      createdAt: workOrders.createdAt,
      boardSortOrder: workOrders.boardSortOrder,
      assetId: workOrders.assetId,
      assigneeId: workOrders.assigneeId,
      assetName: assets.name,
      assetAssetId: assets.assetId,
      assigneeName: users.name,
      assigneeAvatarUrl: users.avatarUrl,
      assigneeAvatarBackgroundColor: users.avatarBackgroundColor,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .orderBy(asc(workOrders.boardSortOrder), desc(workOrders.createdAt));

  const rows = conditions.length
    ? await base.where(and(...conditions))
    : await base;

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  const id = createId();
  const folio = await getNextWorkOrderFolio();
  const now = new Date();
  const checklistTemplateId = body.checklistTemplateId || null;
  await db.insert(workOrders).values({
    id,
    folio,
    title,
    description: body.description?.trim() || null,
    status: "open",
    priority: body.priority ?? "medium",
    kind: "on_demand",
    assetId: body.assetId || null,
    assigneeId: body.assigneeId || null,
    requesterId: session.id,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    createdAt: now,
    updatedAt: now,
  });
  if (body.assigneeId && body.assigneeId !== session.id) {
    await createNotification({
      userId: body.assigneeId,
      type: "assignment",
      title: "Nueva tarea asignada",
      body: title,
      workOrderId: id,
    });
  }
  if (checklistTemplateId) {
    const templateItems = await db.query.checklistTemplateItems.findMany({
      where: eq(checklistTemplateItems.checklistTemplateId, checklistTemplateId),
      orderBy: (items, { asc }) => [asc(items.sortOrder)],
    });
    for (const it of templateItems) {
      await db.insert(workOrderChecklist).values({
        id: createId(),
        workOrderId: id,
        checklistTemplateId,
        type: it.type,
        label: it.label,
        sortOrder: it.sortOrder,
        completed: false,
        fieldType: it.fieldType,
        options: it.options,
      });
    }
  }
  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: {
      title,
      status: "open",
      priority: body.priority ?? "medium",
      assetId: body.assetId || null,
      assigneeId: body.assigneeId || null,
      checklistTemplateId,
      dueDate: body.dueDate ?? null,
    },
  });
  return NextResponse.json({ id });
}
