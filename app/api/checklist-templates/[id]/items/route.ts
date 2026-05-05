import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";

type ItemSnapshot = {
  type: "step" | "custom_field" | "text_block";
  label: string;
  fieldType?: string | null;
  options?: string[] | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "supervisor") {
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
  if (session.role === "supervisor") {
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
  const items: Array<Record<string, unknown>> = Array.isArray(body.items)
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
  }));

  const nextItems: ItemSnapshot[] = items.map((it: Record<string, unknown>) => {
    const type =
      it.type === "custom_field"
        ? "custom_field"
        : it.type === "text_block"
          ? "text_block"
          : "step";
    return {
      type,
      label: String(
        it.label ?? (type === "custom_field" ? "Campo" : "Texto")
      ).trim(),
      fieldType:
        type === "custom_field"
          ? String(it.fieldType ?? "text")
          : type === "text_block"
            ? String(it.fieldType ?? "paragraph")
            : null,
      options:
        type === "custom_field" &&
        String(it.fieldType ?? "text") === "dropdown" &&
        Array.isArray(it.options)
          ? (it.options as unknown[]).map((opt) => String(opt))
          : null,
    };
  });

  await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.checklistTemplateId, templateId));
  for (let i = 0; i < items.length; i++) {
    const it: Record<string, unknown> = items[i]!;
    const type =
      it.type === "custom_field"
        ? "custom_field"
        : it.type === "text_block"
          ? "text_block"
          : "step";
    const label = String(
      it.label ??
      (type === "custom_field"
        ? "Campo"
        : type === "text_block"
          ? "Texto"
          : "Paso")
    ).trim();
    const rawFieldType = typeof it.fieldType === "string" ? it.fieldType : "";
    const fieldType:
      | "text"
      | "number"
      | "date"
      | "dropdown"
      | "checkbox"
      | "photo"
      | "title"
      | "subtitle"
      | "paragraph"
      | null =
      type === "custom_field"
        ? rawFieldType === "number" ||
          rawFieldType === "date" ||
          rawFieldType === "dropdown" ||
          rawFieldType === "checkbox" ||
          rawFieldType === "photo"
          ? rawFieldType
          : "text"
        : type === "text_block"
          ? rawFieldType === "title" ||
            rawFieldType === "subtitle" ||
            rawFieldType === "paragraph"
            ? rawFieldType
            : "paragraph"
          : null;
    const options: string[] | null =
      type === "custom_field" &&
      fieldType === "dropdown" &&
      Array.isArray(it.options)
        ? (it.options as unknown[]).map((opt) => String(opt))
        : null;
    await db.insert(checklistTemplateItems).values({
      id: createId(),
      checklistTemplateId: templateId,
      type,
      label,
      sortOrder: i,
      fieldType,
      options,
    });
  }
  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: "items_updated",
    userId: session.id,
    metadata: {
      itemsCount: items.length,
      before: beforeItems,
      after: nextItems,
    },
  });
  return NextResponse.json({ ok: true });
}
