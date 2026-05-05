import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";

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
  if (session.role === "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const id = createId();
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.map((it: Record<string, unknown>) => {
    const type =
      it.type === "custom_field" || it.type === "text_block" || it.type === "step"
        ? it.type
        : "step";
    return {
      type,
      label: String(it.label ?? "").trim() || "Elemento",
      fieldType: it.fieldType ? String(it.fieldType) : null,
      options:
        Array.isArray(it.options) && it.fieldType === "dropdown"
          ? (it.options as unknown[]).map((opt) => String(opt))
          : null,
    };
  });
  await db.insert(checklistTemplates).values({
    id,
    name,
    description: body.description?.trim() || null,
  });
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!;
    await db.insert(checklistTemplateItems).values({
      id: createId(),
      checklistTemplateId: id,
      type: it.type as "step" | "custom_field" | "text_block",
      label: it.label,
      sortOrder: i,
      fieldType: it.fieldType as
        | "text"
        | "number"
        | "date"
        | "dropdown"
        | "checkbox"
        | "photo"
        | "title"
        | "subtitle"
        | "paragraph"
        | null,
      options: it.options,
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
        items,
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
