import { loadWorkOrderAssignees } from "@/lib/assignees";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

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
      // Ignore parse failures and preserve original.
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

export async function getWorkOrderById(id: string) {
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  if (!wo) return null;
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
      // Ignore malformed URLs; keep other mappings.
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
  return {
    ...wo,
    asset: asset
      ? {
          id: asset.id,
          name: asset.name,
          assetId: asset.assetId,
          tracksMachineDowntime: asset.tracksMachineDowntime,
        }
      : null,
    assignees,
    assigneeIds: assignees.map((a) => a.id),
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
  };
}
