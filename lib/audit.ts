import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createId } from "@/lib/id";

type AuditParams = {
  entityType: string;
  entityId: string;
  action: string;
  /** Actor; omitir o null para eventos sin usuario autenticado */
  userId?: string | null;
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
    userId: userId ?? null,
    metadata: (metadata ?? null) as Record<string, unknown> | null,
  });
}

