import { NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      workOrderId: notifications.workOrderId,
      noteId: notifications.noteId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, session.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  const unreadRow = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, session.id), isNull(notifications.readAt))
    );

  return NextResponse.json({
    items: list,
    unreadCount: Number(unreadRow[0]?.count ?? 0),
  });
}

export async function PATCH() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, session.id), isNull(notifications.readAt)));
  return NextResponse.json({ ok: true });
}
