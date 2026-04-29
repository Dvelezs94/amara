import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments, notes, users, workOrders } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { createNotification, extractMentionedUserIds } from "@/lib/notifications";
import { createId } from "@/lib/id";
import { uploadFileToS3 } from "@/lib/s3-storage";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

function attachmentToken(attachmentId: string, filename: string): string {
  return `[[fileid:${attachmentId}|${encodeURIComponent(filename)}]]`;
}

const ATTACHMENT_TOKEN_REGEX = /\[\[file:([^|\]]+)\|([^\]]+)\]\]/g;
const ATTACHMENT_TOKEN_WITH_ID_REGEX = /\[\[fileid:([^|\]]+)\|([^\]]+)\]\]/g;

function rewriteAttachmentTokensToDownloadUrls(
  body: string,
  workOrderId: string,
  byId: Map<string, string>,
  byUrl: Map<string, string>
): string {
  const withNewTokens = body.replace(
    ATTACHMENT_TOKEN_WITH_ID_REGEX,
    (_full, attachmentId: string, encodedFilename: string) =>
      `[[file:${encodedFilename}|${byId.get(attachmentId) ?? `/api/work-orders/${workOrderId}/attachments/${attachmentId}/download`}]]`
  );
  return withNewTokens.replace(
    ATTACHMENT_TOKEN_REGEX,
    (_full, encodedFilename: string, fileUrl: string) =>
      `[[file:${encodedFilename}|${byUrl.get(fileUrl) ?? fileUrl}]]`
  );
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
    columns: { id: true },
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.query.notes.findMany({
    where: eq(notes.workOrderId, id),
    orderBy: [desc(notes.createdAt)],
  });
  if (rows.length === 0) {
    return NextResponse.json([]);
  }
  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, id),
    columns: { id: true, fileUrl: true },
  });
  const byId = new Map(
    attachmentRows.map((row) => [
      row.id,
      `/api/work-orders/${id}/attachments/${row.id}/download`,
    ])
  );
  const byUrl = new Map(
    attachmentRows.map((row) => [
      row.fileUrl,
      `/api/work-orders/${id}/attachments/${row.id}/download`,
    ])
  );

  const uniqueUserIds = Array.from(new Set(rows.map((row) => row.userId)));
  const authorRows = await db.query.users.findMany({
    where: (t, { inArray }) => inArray(t.id, uniqueUserIds),
    columns: {
      id: true,
      name: true,
      avatarUrl: true,
      avatarBackgroundColor: true,
    },
  });
  const authorMap = new Map(authorRows.map((user) => [user.id, user]));

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      body: rewriteAttachmentTokensToDownloadUrls(row.body, id, byId, byUrl),
      createdAt: row.createdAt,
      user: authorMap.get(row.userId) ?? null,
    }))
  );
}

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

  const contentType = req.headers.get("content-type") ?? "";
  let commentBody = "";
  const incomingFiles: File[] = [];
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (formData == null) {
      return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
    }
    commentBody = String(formData.get("body") ?? "").trim();
    for (const entry of formData.getAll("files")) {
      if (entry instanceof File && entry.size > 0) incomingFiles.push(entry);
    }
  } else {
    const body = await req.json().catch(() => ({}));
    commentBody = typeof body.body === "string" ? body.body.trim() : "";
  }
  if (!commentBody && incomingFiles.length === 0) {
    return NextResponse.json(
      { error: "El comentario no puede estar vacío" },
      { status: 400 }
    );
  }

  const uploaded: { id: string; fileUrl: string; filename: string }[] = [];
  if (incomingFiles.length > 0) {
    for (const file of incomingFiles) {
      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : ".bin";
      const baseName = sanitizeFilename(file.name.slice(0, file.name.length - ext.length));
      const uniqueName = `${createId()}${ext}`;
      const bytes = await file.arrayBuffer();
      const objectKey = `work-orders/${uniqueName}`;
      const fileUrl = await uploadFileToS3({
        objectKey,
        bytes: Buffer.from(bytes),
        contentType: file.type || "application/octet-stream",
      });
      const idAttachment = createId();
      const displayName = baseName + ext || file.name;
      uploaded.push({ id: idAttachment, fileUrl, filename: displayName });
      await db.insert(attachments).values({
        id: idAttachment,
        workOrderId: id,
        userId: session.id,
        fileUrl,
        filename: displayName,
      });
    }
  }

  const fullBody = [commentBody, ...uploaded.map((f) => attachmentToken(f.id, f.filename))]
    .filter((part) => part.trim() !== "")
    .join("\n");

  const idNote = randomUUID();
  const createdAt = new Date();
  await db.insert(notes).values({
    id: idNote,
    workOrderId: id,
    userId: session.id,
    body: fullBody,
    createdAt,
  });
  const author = await db.query.users.findFirst({
    where: eq(users.id, session.id),
    columns: {
      id: true,
      name: true,
      avatarUrl: true,
      avatarBackgroundColor: true,
    },
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
      attachmentCount: uploaded.length,
    },
  });

  return NextResponse.json({
    id: idNote,
    body: rewriteAttachmentTokensToDownloadUrls(
      fullBody,
      id,
      new Map(uploaded.map((f) => [f.id, `/api/work-orders/${id}/attachments/${f.id}/download`])),
      new Map(uploaded.map((f) => [f.fileUrl, `/api/work-orders/${id}/attachments/${f.id}/download`]))
    ),
    createdAt: createdAt.toISOString(),
    user: author ?? null,
  });
}
