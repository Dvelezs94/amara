import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function getWorkOrderById(id: string) {
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });
  if (!wo) return null;
  const [asset, assignee, requester] = await Promise.all([
    wo.assetId
      ? db.query.assets.findFirst({ where: eq(assets.id, wo.assetId) })
      : null,
    wo.assigneeId
      ? db.query.users.findFirst({
          where: eq(users.id, wo.assigneeId),
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
  return {
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
    checklist,
    attachments: attachmentList.map((row) => ({
      ...row,
      fileUrl: `/api/work-orders/${id}/attachments/${row.id}/download`,
    })),
  };
}
