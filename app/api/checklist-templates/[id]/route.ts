import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, id),
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, id),
    orderBy: (items, { asc }) => [asc(items.sortOrder)],
  });
  return NextResponse.json({ ...template, items });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, id),
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() ?? null;
  if (Object.keys(updates).length > 0) {
    await db.update(checklistTemplates).set(updates).where(eq(checklistTemplates.id, id));
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
  const { id } = await params;
  await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
  return NextResponse.json({ ok: true });
}
