import { eq, inArray } from "drizzle-orm";
import {
  buildChecklistRevisionReviewRequestBody,
  CHECKLIST_REVISION_REVIEW_TITLE,
} from "@/lib/checklist-notification-parse";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { createId } from "@/lib/id";

/** Notifies every calidad user when a checklist revision is submitted for review (status proposed). */
export async function notifyCalidadUsersChecklistRevisionProposed(input: {
  templateId: string;
  revisionId: string;
  templateName: string;
  revisionName: string;
  proposedByUserId: string;
  proposedByName: string | null;
}): Promise<void> {
  try {
    const body = buildChecklistRevisionReviewRequestBody({
      templateId: input.templateId,
      revisionId: input.revisionId,
      templateName: input.templateName,
      revisionName: input.revisionName,
      proposedByName: input.proposedByName,
    });

    const calidadUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "calidad"));

    const targets = calidadUsers.filter((u) => u.id !== input.proposedByUserId);
    if (targets.length === 0) return;

    await Promise.allSettled(
      targets.map((u) =>
        createNotification({
          userId: u.id,
          type: "work_order_update",
          title: CHECKLIST_REVISION_REVIEW_TITLE,
          body,
        })
      )
    );
  } catch {
    // Best effort: never block revision submission.
  }
}

export async function createNotification(input: {
  userId: string;
  type: "assignment" | "work_order_update" | "mention";
  title: string;
  body?: string | null;
  workOrderId?: string | null;
  noteId?: string | null;
}) {
  await db.insert(notifications).values({
    id: createId(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    workOrderId: input.workOrderId ?? null,
    noteId: input.noteId ?? null,
    createdAt: new Date(),
  });
}

export async function extractMentionedUserIds(comment: string): Promise<string[]> {
  const matches = Array.from(
    comment.matchAll(/(?:^|\s)@([a-z0-9._-]{2,32})/gi),
    (m) => m[1]?.toLowerCase()
  ).filter((v): v is string => Boolean(v));
  const usernames = Array.from(new Set(matches));
  if (usernames.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, usernames));
  return rows.map((r) => r.id);
}
