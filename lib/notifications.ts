import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { createId } from "@/lib/id";

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
