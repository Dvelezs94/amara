import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistFolders, checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import {
  mapChecklistItemsToInsertRows,
  parseChecklistTemplateItemsFromClientJson,
} from "@/lib/checklist-items-from-payload";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db
    .select()
    .from(checklistTemplates)
    .orderBy(desc(checklistTemplates.createdAt));
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
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  let folderId: string | null = null;
  if (body.folderId !== undefined && body.folderId !== null && body.folderId !== "") {
    const fid = String(body.folderId).trim();
    if (fid) {
      const folder = await db.query.checklistFolders.findFirst({
        where: eq(checklistFolders.id, fid),
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 400 });
      }
      folderId = fid;
    }
  }

  const id = createId();
  const rawItems = Array.isArray(body.items)
    ? (body.items as Array<Record<string, unknown>>)
    : [];
  const { items: parsed, error: parseError } =
    parseChecklistTemplateItemsFromClientJson(rawItems);
  if (parseError) {
    return NextResponse.json({ error: parseError }, { status: 400 });
  }
  const insertRows = mapChecklistItemsToInsertRows(parsed, createId);
  const snapshotItems = insertRows.map((row) => ({
    id: row.id,
    parentItemId: row.parentItemId,
    type: row.type,
    label: row.label,
    fieldType: row.fieldType,
    options: row.options,
    ...(row.isOptional ? { isOptional: true } : {}),
  }));
  await db.insert(checklistTemplates).values({
    id,
    name,
    description: body.description?.trim() || null,
    folderId,
  });
  for (const row of insertRows) {
    await db.insert(checklistTemplateItems).values({
      id: row.id,
      checklistTemplateId: id,
      parentItemId: row.parentItemId,
      type: row.type,
      label: row.label,
      sortOrder: row.sortOrder,
      fieldType: row.fieldType,
      options: row.options,
      isOptional: row.isOptional,
    });
  }
  await db.insert(checklistTemplateRevisions).values({
    id: createId(),
    checklistTemplateId: id,
    revisionNumber: 0,
    name: "Revision 0",
    status: "approved",
    proposedByUserId: session.id,
    reviewedByUserId: session.id,
    reviewedAt: new Date(),
    snapshot: {
      after: {
        name,
        description: body.description?.trim() || null,
        items: snapshotItems,
      },
    },
    createdAt: new Date(),
  });
  await recordAuditLog({
    entityType: "checklist_template",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: { name, description: body.description ?? null },
  });
  return NextResponse.json({ id });
}
