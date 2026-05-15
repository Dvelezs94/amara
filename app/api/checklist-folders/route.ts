import { NextResponse } from "next/server";
import { asc, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistFolders } from "@/lib/db/schema";
import { createId } from "@/lib/id";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db
    .select()
    .from(checklistFolders)
    .orderBy(asc(checklistFolders.sortOrder), asc(checklistFolders.name));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const parentFolderId =
    body.parentFolderId === undefined || body.parentFolderId === null
      ? null
      : String(body.parentFolderId).trim() || null;
  if (parentFolderId) {
    const parent = await db.query.checklistFolders.findFirst({
      where: eq(checklistFolders.id, parentFolderId),
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
    }
  }
  const siblings = await db
    .select({ sortOrder: checklistFolders.sortOrder })
    .from(checklistFolders)
    .where(
      parentFolderId === null
        ? isNull(checklistFolders.parentFolderId)
        : eq(checklistFolders.parentFolderId, parentFolderId)
    );
  const sortOrder = siblings.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;

  const id = createId();
  await db.insert(checklistFolders).values({
    id,
    name,
    parentFolderId,
    sortOrder,
  });
  return NextResponse.json({ id });
}
