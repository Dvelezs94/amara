import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createId } from "@/lib/id";

type AuditParams = {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  metadata?: unknown;
};

export async function recordAuditLog({
  entityType,
  entityId,
  action,
  userId,
  metadata,
}: AuditParams) {
  await db.insert(auditLogs).values({
    id: createId(),
    entityType,
    entityId,
    action,
    userId,
    metadata: metadata ?? null,
  });
}

