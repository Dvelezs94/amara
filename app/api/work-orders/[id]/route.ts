import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { and, eq, desc, max } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

function normalizeChecklistPhotoValue(
  value: unknown,
  workOrderId: string,
  byAttachmentId: Map<string, string>,
  byS3BaseUrl: Map<string, string>
): unknown {
  const normalizeOne = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("/api/work-orders/")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith(`/api/work-orders/${workOrderId}/attachments/`)) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      const parts = parsed.pathname.split("/");
      const maybeId = parts[parts.length - 2] ?? "";
      if (maybeId && byAttachmentId.has(maybeId)) {
        return byAttachmentId.get(maybeId)!;
      }
      const lookup = `${parsed.origin}${parsed.pathname}`;
      if (byS3BaseUrl.has(lookup)) {
        return byS3BaseUrl.get(lookup)!;
      }
    } catch {
      // Preserve original if URL parsing fails.
    }
    return trimmed;
  };

  const collect = (input: unknown): string[] => {
    if (Array.isArray(input)) return input.flatMap(collect);
    if (typeof input === "string") {
      const s = input.trim();
      if (!s) return [];
      if (
        (s.startsWith("[") && s.endsWith("]")) ||
        (s.startsWith("{") && s.endsWith("}"))
      ) {
        try {
          return collect(JSON.parse(s));
        } catch {
          return [normalizeOne(s)];
        }
      }
      return [normalizeOne(s)];
    }
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      return [
        ...collect(obj.fileUrl),
        ...collect(obj.url),
        ...collect(obj.src),
        ...collect(obj.value),
        ...collect(obj.values),
        ...collect(obj.photos),
        ...collect(obj.attachments),
      ];
    }
    return [];
  };

  const urls = Array.from(new Set(collect(value).filter((u) => u !== "")));
  if (urls.length <= 1) return urls[0] ?? null;
  return urls;
}

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
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            avatarBackgroundColor: true,
          },
        })
      : null,
    wo.requesterId
      ? db.query.users.findFirst({
          where: eq(users.id, wo.requesterId),
          columns: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarBackgroundColor: true,
          },
        })
      : null,
  ]);
  const checklist = await db.query.workOrderChecklist.findMany({
    where: eq(workOrderChecklist.workOrderId, id),
    orderBy: (items, { asc }) => [asc(items.sortOrder)],
  });
  const checklistTemplateId =
    checklist.find((item) => item.checklistTemplateId != null)?.checklistTemplateId ?? null;
  const [checklistTemplate, approvedRevision] = await Promise.all([
    checklistTemplateId
      ? db.query.checklistTemplates.findFirst({
          where: eq(checklistTemplates.id, checklistTemplateId),
        })
      : null,
    checklistTemplateId
      ? db.query.checklistTemplateRevisions.findFirst({
          where: and(
            eq(checklistTemplateRevisions.checklistTemplateId, checklistTemplateId),
            eq(checklistTemplateRevisions.status, "approved")
          ),
          orderBy: (rev, { desc }) => [desc(rev.revisionNumber)],
        })
      : null,
  ]);
  const attachmentList = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, id),
    orderBy: [desc(attachments.createdAt)],
  });
  const attachmentDownloadById = new Map<string, string>();
  const attachmentDownloadByS3Base = new Map<string, string>();
  for (const row of attachmentList) {
    const internalUrl = `/api/work-orders/${id}/attachments/${row.id}/download`;
    attachmentDownloadById.set(row.id, internalUrl);
    try {
      const parsed = new URL(row.fileUrl);
      attachmentDownloadByS3Base.set(`${parsed.origin}${parsed.pathname}`, internalUrl);
    } catch {
      // ignore malformed urls
    }
  }
  const normalizedChecklist = checklist.map((item) =>
    item.fieldType === "photo"
      ? {
          ...item,
          value: normalizeChecklistPhotoValue(
            item.value,
            id,
            attachmentDownloadById,
            attachmentDownloadByS3Base
          ),
        }
      : item
  );
  return NextResponse.json({
    ...wo,
    asset: asset
      ? { id: asset.id, name: asset.name, assetId: asset.assetId }
      : null,
    assignee: assignee ?? null,
    requester: requester ?? null,
    checklistMeta:
      checklistTemplate != null
        ? {
            templateName: checklistTemplate.name,
            revisionName: approvedRevision?.name ?? null,
            revisionNumber: approvedRevision?.revisionNumber ?? null,
          }
        : null,
    checklist: normalizedChecklist,
    attachments: attachmentList.map((row) => ({
      ...row,
      fileUrl: `/api/work-orders/${id}/attachments/${row.id}/download`,
    })),
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
  if (body.status === "open") body.status = "pending";
  const allowedStatus = new Set([
    "pending",
    "in_progress",
    "completed",
    "cancelled",
  ]);
  if (
    body.status !== undefined &&
    typeof body.status === "string" &&
    !allowedStatus.has(body.status)
  ) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
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
  if (body.status !== undefined && body.status !== wo.status) {
    const [maxRow] = await db
      .select({ m: max(workOrders.boardSortOrder) })
      .from(workOrders)
      .where(eq(workOrders.status, body.status));
    updates.status = body.status;
    updates.boardSortOrder = (maxRow?.m ?? -1) + 1;
  } else if (body.status !== undefined) {
    updates.status = body.status;
  }
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assetId !== undefined) updates.assetId = body.assetId || null;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId || null;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  const isCompleting = body.status === "completed";
  if (isCompleting) {
    const checklistItems = await db.query.workOrderChecklist.findMany({
      where: eq(workOrderChecklist.workOrderId, id),
      orderBy: (items, { asc }) => [asc(items.sortOrder)],
    });
    const checklistCompletionError =
      "No se puede completar la tarea: marca todos los pasos y completa todos los campos del checklist.";
    for (const item of checklistItems) {
      if (item.type === "step") {
        if (item.completed !== true) {
          return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
        }
        continue;
      }
      if (item.type === "custom_field") {
        if (item.fieldType === "checkbox") {
          if (typeof item.value !== "boolean") {
            return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
          }
          continue;
        }
        if (item.value == null) {
          return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
        }
        if (typeof item.value === "number" && Number.isNaN(item.value)) {
          return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
        }
        if (typeof item.value !== "number") {
          const valueAsText = String(item.value).trim();
          if (valueAsText === "") {
            return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
          }
        }
      }
    }
  }
  if (body.status === "completed") updates.completedAt = new Date();
  if (
    body.status === "in_progress" &&
    wo.status !== "in_progress" &&
    wo.startedAt == null
  ) {
    updates.startedAt = new Date();
  }

  await db.update(workOrders).set(updates).where(eq(workOrders.id, id));

  const nextAssigneeId =
    body.assigneeId !== undefined ? body.assigneeId || null : wo.assigneeId;
  const assigneeChanged = body.assigneeId !== undefined && nextAssigneeId !== wo.assigneeId;
  if (assigneeChanged && nextAssigneeId && nextAssigneeId !== session.id) {
    await createNotification({
      userId: nextAssigneeId,
      type: "assignment",
      title: "Nueva tarea asignada",
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
