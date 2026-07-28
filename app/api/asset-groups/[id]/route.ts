import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetGroups } from "@/lib/db/schema";

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
  const group = await db.query.assetGroups.findFirst({
    where: eq(assetGroups.id, id),
  });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: {
    name?: string;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const nextName = String(body.name).trim();
    if (nextName && nextName !== group.name) updates.name = nextName;
  }
  if (body.sortOrder !== undefined && typeof body.sortOrder === "number") {
    updates.sortOrder = body.sortOrder;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(assetGroups).set(updates).where(eq(assetGroups.id, id));
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
  const group = await db.query.assetGroups.findFirst({
    where: eq(assetGroups.id, id),
  });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(assetGroups).where(eq(assetGroups.id, id));
  return NextResponse.json({ ok: true });
}
