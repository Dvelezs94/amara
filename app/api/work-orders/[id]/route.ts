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
import { loadWorkOrderAssignees, setWorkOrderAssigneeIds } from "@/lib/assignees";
import { createNotification } from "@/lib/notifications";
import { clampManualDowntimeMinutes } from "@/lib/machine-downtime";
import { checklistItemBlocksWorkOrderCompletion } from "@/lib/checklist-completion";
import { validateWorkOrderCompletedAt } from "@/lib/datetime-local";
import { canDeleteWorkOrder } from "@/lib/auth-shared";
import { workOrderAssignedToUserIds } from "@/lib/work-order-assignee";

async function assetAllowsDowntimeTracking(assetId: string | null): Promise<boolean> {
  if (!assetId) return false;
  const a = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
    columns: { tracksMachineDowntime: true },
  });
  return a?.tracksMachineDowntime !== false;
}

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
  const assignees = await loadWorkOrderAssignees(id, wo.assigneeId);
  const assignee = assignees[0] ?? null;

  const [asset, requester] = await Promise.all([
    wo.assetId
      ? db.query.assets.findFirst({ where: eq(assets.id, wo.assetId) })
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
      ? {
          id: asset.id,
          name: asset.name,
          assetId: asset.assetId,
          tracksMachineDowntime: asset.tracksMachineDowntime,
        }
      : null,
    assigneeIds: assignees.map((a) => a.id),
    assignees,
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
  const body = await req.json().catch(() => ({}));
  if (body.status === "open") body.status = "pending";
  const allowedStatus = new Set([
    "pending",
    "in_progress",
    "completed",
    "cancelled",
  ]);

  const leavingCompleted =
    wo.status === "completed" &&
    body.status !== undefined &&
    typeof body.status === "string" &&
    body.status !== "completed" &&
    allowedStatus.has(body.status);

  if (wo.status === "completed" && !leavingCompleted) {
    const keys = Object.keys(body);
    const allowed = new Set(["manualDowntimeMinutes", "countsMachineDowntime"]);
    if (session.role === "admin") allowed.add("completedAt");
    if (keys.length === 0 || keys.some((k) => !allowed.has(k))) {
      return NextResponse.json(
        { error: "No se puede modificar una orden completada" },
        { status: 403 }
      );
    }
    if (body.completedAt !== undefined && session.role !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden cambiar la fecha de completado" },
        { status: 403 }
      );
    }
    const updates: Partial<typeof workOrders.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.manualDowntimeMinutes !== undefined) {
      const m = clampManualDowntimeMinutes(body.manualDowntimeMinutes);
      if (m === null) {
        return NextResponse.json(
          { error: "Paro manual inválido (use minutos enteros entre 0 y 525600)" },
          { status: 400 }
        );
      }
      updates.manualDowntimeMinutes = m;
    }
    if (body.countsMachineDowntime !== undefined) {
      if (typeof body.countsMachineDowntime !== "boolean") {
        return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      }
      const allows = await assetAllowsDowntimeTracking(wo.assetId);
      if (body.countsMachineDowntime === true && !allows) {
        return NextResponse.json(
          { error: "Esta máquina no permite registrar paro de máquina." },
          { status: 400 }
        );
      }
      updates.countsMachineDowntime = body.countsMachineDowntime === true && allows;
    }
    if (body.completedAt !== undefined) {
      const parsed =
        typeof body.completedAt === "string" || body.completedAt instanceof Date
          ? new Date(body.completedAt)
          : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Fecha de completado inválida" },
          { status: 400 }
        );
      }
      const validationError = validateWorkOrderCompletedAt(parsed);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      updates.completedAt = parsed;
    }
    await db.update(workOrders).set(updates).where(eq(workOrders.id, id));
    const woAfter = await db.query.workOrders.findFirst({
      where: eq(workOrders.id, id),
    });
    await recordAuditLog({
      entityType: "work_order",
      entityId: id,
      action: "updated",
      userId: session.id,
      metadata: {
        before: {
          countsMachineDowntime: wo.countsMachineDowntime,
          manualDowntimeMinutes: wo.manualDowntimeMinutes,
          completedAt: wo.completedAt,
        },
        after: {
          countsMachineDowntime: woAfter?.countsMachineDowntime ?? wo.countsMachineDowntime,
          manualDowntimeMinutes: woAfter?.manualDowntimeMinutes ?? wo.manualDowntimeMinutes,
          completedAt: woAfter?.completedAt ?? wo.completedAt,
        },
        note: body.completedAt !== undefined ? "completed_at_on_completed" : "downtime_fields_on_completed",
      },
    });
    return NextResponse.json({ ok: true });
  }
  if (
    body.status !== undefined &&
    typeof body.status === "string" &&
    !allowedStatus.has(body.status)
  ) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (
    (body.assigneeId !== undefined || body.assigneeIds !== undefined) &&
    session.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Solo administradores pueden cambiar el asignado" },
      { status: 403 }
    );
  }
  if (
    body.status === "in_progress" &&
    wo.status !== "in_progress" &&
    session.role !== "admin"
  ) {
    const startAssignees = await loadWorkOrderAssignees(id, wo.assigneeId);
    if (
      !workOrderAssignedToUserIds(
        startAssignees.map((a) => a.id),
        wo.assigneeId,
        session.id
      )
    ) {
      return NextResponse.json(
        { error: "Solo el técnico asignado puede iniciar esta tarea." },
        { status: 403 }
      );
    }
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
  const nextAssetId =
    body.assetId !== undefined
      ? typeof body.assetId === "string" && body.assetId.trim()
        ? body.assetId.trim()
        : null
      : wo.assetId;
  const downtimeAllowedAt = await assetAllowsDowntimeTracking(nextAssetId);
  if (body.assetId !== undefined) {
    updates.assetId =
      typeof body.assetId === "string" && body.assetId.trim() ? body.assetId.trim() : null;
  }
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.countsMachineDowntime !== undefined) {
    if (typeof body.countsMachineDowntime !== "boolean") {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (body.countsMachineDowntime === true && !downtimeAllowedAt) {
      return NextResponse.json(
        { error: "Esta máquina no permite registrar paro de máquina." },
        { status: 400 }
      );
    }
    updates.countsMachineDowntime = body.countsMachineDowntime === true && downtimeAllowedAt;
  }
  if (body.assetId !== undefined && !downtimeAllowedAt) {
    updates.countsMachineDowntime = false;
  }
  if (body.manualDowntimeMinutes !== undefined) {
    const m = clampManualDowntimeMinutes(body.manualDowntimeMinutes);
    if (m === null) {
      return NextResponse.json(
        { error: "Paro manual inválido (use minutos enteros entre 0 y 525600)" },
        { status: 400 }
      );
    }
    updates.manualDowntimeMinutes = m;
  }
  const isCompleting = body.status === "completed";
  if (isCompleting) {
    const checklistItems = await db.query.workOrderChecklist.findMany({
      where: eq(workOrderChecklist.workOrderId, id),
      orderBy: (items, { asc }) => [asc(items.sortOrder)],
    });
    const checklistCompletionError =
      "No se puede completar la tarea: marca todos los pasos y completa todos los campos obligatorios del checklist.";
    for (const item of checklistItems) {
      if (
        checklistItemBlocksWorkOrderCompletion({
          type: item.type,
          completed: item.completed,
          fieldType: item.fieldType,
          value: item.value,
          isOptional: item.isOptional,
        })
      ) {
        return NextResponse.json({ error: checklistCompletionError }, { status: 400 });
      }
    }
  }
  if (body.status === "completed") {
    updates.completedAt = new Date();
  } else if (body.status !== undefined) {
    updates.completedAt = null;
  }
  if (
    body.status === "in_progress" &&
    wo.status !== "in_progress" &&
    wo.startedAt == null
  ) {
    updates.startedAt = new Date();
  }

  const prevAssignees = await loadWorkOrderAssignees(id, wo.assigneeId);
  const prevIdSet = new Set(prevAssignees.map((a) => a.id));

  let nextAssigneeList: string[] | null = null;
  if (session.role === "admin" && body.assigneeIds !== undefined) {
    if (!Array.isArray(body.assigneeIds)) {
      return NextResponse.json({ error: "assigneeIds inválido" }, { status: 400 });
    }
    nextAssigneeList = Array.from(
      new Set(
        body.assigneeIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      )
    );
    for (const uid of nextAssigneeList) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, uid),
        columns: { id: true },
      });
      if (!u) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
      }
    }
  } else if (session.role === "admin" && body.assigneeId !== undefined) {
    nextAssigneeList =
      body.assigneeId && String(body.assigneeId).trim()
        ? [String(body.assigneeId).trim()]
        : [];
    if (nextAssigneeList.length) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, nextAssigneeList[0]!),
        columns: { id: true },
      });
      if (!u) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
      }
    }
  }

  await db.update(workOrders).set(updates).where(eq(workOrders.id, id));

  let assigneeListUpdated = false;
  if (nextAssigneeList !== null) {
    await setWorkOrderAssigneeIds(id, nextAssigneeList);
    assigneeListUpdated = true;
    for (const uid of nextAssigneeList) {
      if (!prevIdSet.has(uid) && uid !== session.id) {
        await createNotification({
          userId: uid,
          type: "assignment",
          title: "Nueva tarea asignada",
          body: wo.title,
          workOrderId: id,
        });
      }
    }
  }

  const nonAssigneePatch =
    body.title !== undefined ||
    body.description !== undefined ||
    body.status !== undefined ||
    body.priority !== undefined ||
    body.assetId !== undefined ||
    body.dueDate !== undefined ||
    body.countsMachineDowntime !== undefined ||
    body.manualDowntimeMinutes !== undefined;
  if (!assigneeListUpdated && nonAssigneePatch) {
    for (const a of prevAssignees) {
      if (a.id !== session.id) {
        await createNotification({
          userId: a.id,
          type: "work_order_update",
          title: "Actualización en orden asignada",
          body: wo.title,
          workOrderId: id,
        });
      }
    }
  }

  const woFinal = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  const assigneesAfter = await loadWorkOrderAssignees(
    id,
    woFinal?.assigneeId ?? null
  );

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
        assigneeId: woFinal?.assigneeId ?? wo.assigneeId,
        assigneeIds: assigneesAfter.map((a) => a.id),
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
  if (!canDeleteWorkOrder(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
