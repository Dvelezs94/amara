import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { ilike, desc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const base = db.select().from(assets).orderBy(desc(assets.updatedAt));
  const list = q ? await base.where(ilike(assets.name, `%${q}%`)) : await base;
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  const assetId = (body.assetId ?? "").trim();
  if (!name || !assetId) {
    return NextResponse.json(
      { error: "Name and asset ID required" },
      { status: 400 }
    );
  }
  const id = createId();
  const now = new Date();
  const tracksMachineDowntime =
    body.tracksMachineDowntime === false || body.tracksMachineDowntime === "false"
      ? false
      : true;
  await db.insert(assets).values({
    id,
    name,
    assetId,
    locationId: body.locationId || null,
    parentAssetId: body.parentAssetId || null,
    qrCode: body.qrCode || null,
    metadata: body.metadata ?? null,
    tracksMachineDowntime,
    createdAt: now,
    updatedAt: now,
  });
  await recordAuditLog({
    entityType: "asset",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: { name, assetId },
  });
  return NextResponse.json({ id });
}
