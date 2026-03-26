import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { notes, workOrders } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { createNotification, extractMentionedUserIds } from "@/lib/notifications";

export async function POST(
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
    columns: { id: true, status: true, title: true },
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const commentBody =
    typeof body.body === "string" ? body.body.trim() : "";
  if (!commentBody) {
    return NextResponse.json(
      { error: "El comentario no puede estar vacío" },
      { status: 400 }
    );
  }

  const idNote = randomUUID();
  const createdAt = new Date();
  await db.insert(notes).values({
    id: idNote,
    workOrderId: id,
    userId: session.id,
    body: commentBody,
    createdAt,
  });

  const mentionedUserIds = await extractMentionedUserIds(commentBody);
  for (const mentionedUserId of mentionedUserIds) {
    if (mentionedUserId === session.id) continue;
    await createNotification({
      userId: mentionedUserId,
      type: "mention",
      title: "Te mencionaron en una orden",
      body: wo.title,
      workOrderId: id,
      noteId: idNote,
    });
  }

  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: "comment_added",
    userId: session.id,
    metadata: {
      status: wo.status,
      commentLength: commentBody.length,
    },
  });

  return NextResponse.json({
    id: idNote,
    body: commentBody,
    createdAt: createdAt.toISOString(),
  });
}
