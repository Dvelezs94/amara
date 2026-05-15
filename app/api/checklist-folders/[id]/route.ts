import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  folderMoveCreatesCycle,
  type FolderRow,
} from "@/lib/checklist-folder-helpers";
import { db } from "@/lib/db";
import { checklistFolders } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const folder = await db.query.checklistFolders.findFirst({
    where: eq(checklistFolders.id, id),
  });
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: {
    name?: string;
    parentFolderId?: string | null;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const nextName = String(body.name).trim();
    if (nextName && nextName !== folder.name) updates.name = nextName;
  }
  if (body.sortOrder !== undefined && typeof body.sortOrder === "number") {
    updates.sortOrder = body.sortOrder;
  }
  if (body.parentFolderId !== undefined) {
    const nextParent =
      body.parentFolderId === null || body.parentFolderId === ""
        ? null
        : String(body.parentFolderId).trim() || null;
    if (nextParent) {
      const parent = await db.query.checklistFolders.findFirst({
        where: eq(checklistFolders.id, nextParent),
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
      }
    }
    const allFolders = await db
      .select({
        id: checklistFolders.id,
        parentFolderId: checklistFolders.parentFolderId,
      })
      .from(checklistFolders);
    const rows: FolderRow[] = allFolders.map((f) => ({
      id: f.id,
      parentFolderId: f.parentFolderId ?? null,
    }));
    if (folderMoveCreatesCycle(id, nextParent, rows)) {
      return NextResponse.json({ error: "Invalid parent (cycle)" }, { status: 400 });
    }
    if (nextParent !== (folder.parentFolderId ?? null)) {
      updates.parentFolderId = nextParent;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(checklistFolders).set(updates).where(eq(checklistFolders.id, id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const folder = await db.query.checklistFolders.findFirst({
    where: eq(checklistFolders.id, id),
  });
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(checklistFolders).where(eq(checklistFolders.id, id));
  return NextResponse.json({ ok: true });
}
