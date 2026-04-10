import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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
    checklist,
    attachments: attachmentList,
  };
}
