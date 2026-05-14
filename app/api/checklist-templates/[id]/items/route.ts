import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  mapChecklistItemsToInsertRows,
  parseChecklistTemplateItemsFromClientJson,
} from "@/lib/checklist-items-from-payload";
import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";

type ItemSnapshot = {
  type: "step" | "custom_field" | "text_block" | "section";
  label: string;
  fieldType?: string | null;
  options?: string[] | null;
  parentItemId?: string | null;
  isOptional?: boolean;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const items = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, id),
    orderBy: (items, { asc }) => [asc(items.sortOrder)],
  });
  return NextResponse.json(items);
}

export async function PUT(
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
  const { id: templateId } = await params;
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const rawItems: Array<Record<string, unknown>> = Array.isArray(body.items)
    ? (body.items as Array<Record<string, unknown>>)
    : [];

  const previousItems = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, templateId),
    orderBy: (item, { asc }) => [asc(item.sortOrder)],
  });
  const beforeItems: ItemSnapshot[] = previousItems.map((it) => ({
    type: it.type,
    label: it.label,
    fieldType: it.fieldType,
    options: Array.isArray(it.options) ? (it.options as string[]) : null,
    parentItemId: it.parentItemId ?? null,
    isOptional: it.isOptional === true ? true : undefined,
  }));

  const { items: parsed, error } = parseChecklistTemplateItemsFromClientJson(rawItems);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const insertRows = mapChecklistItemsToInsertRows(parsed, createId);

  const nextItems: ItemSnapshot[] = insertRows.map((row) => ({
    type: row.type,
    label: row.label,
    fieldType: row.fieldType,
    options: row.options,
    parentItemId: row.parentItemId,
    isOptional: row.isOptional ? true : undefined,
  }));

  await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.checklistTemplateId, templateId));
  for (const row of insertRows) {
    await db.insert(checklistTemplateItems).values({
      id: row.id,
      checklistTemplateId: templateId,
      parentItemId: row.parentItemId,
      type: row.type,
      label: row.label,
      sortOrder: row.sortOrder,
      fieldType: row.fieldType,
      options: row.options,
      isOptional: row.isOptional,
    });
  }
  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: "items_updated",
    userId: session.id,
    metadata: {
      itemsCount: insertRows.length,
      before: beforeItems,
      after: nextItems,
    },
  });
  return NextResponse.json({ ok: true });
}
