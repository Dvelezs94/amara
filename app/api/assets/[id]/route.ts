import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const workOrdersList = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      dueDate: workOrders.dueDate,
    })
    .from(workOrders)
    .where(eq(workOrders.assetId, id))
    .orderBy(workOrders.createdAt);
  return NextResponse.json({ ...asset, workOrders: workOrdersList });
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
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: {
    name?: string;
    assetId?: string;
    tracksMachineDowntime?: boolean;
    updatedAt?: Date;
  } = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.assetId !== undefined) updates.assetId = String(body.assetId).trim();
  if (body.tracksMachineDowntime !== undefined) {
    if (typeof body.tracksMachineDowntime !== "boolean") {
      return NextResponse.json({ error: "tracksMachineDowntime inválido" }, { status: 400 });
    }
    updates.tracksMachineDowntime = body.tracksMachineDowntime;
  }

  if (updates.name !== undefined && !updates.name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  if (updates.assetId !== undefined && !updates.assetId) {
    return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
  }
  const hasPatch =
    updates.name !== undefined ||
    updates.assetId !== undefined ||
    updates.tracksMachineDowntime !== undefined;
  if (!hasPatch) {
    return NextResponse.json({ ok: true });
  }

  updates.updatedAt = new Date();
  await db.update(assets).set(updates).where(eq(assets.id, id));
  await recordAuditLog({
    entityType: "asset",
    entityId: id,
    action: "updated",
    userId: session.id,
    metadata: {
      before: { name: asset.name, assetId: asset.assetId, tracksMachineDowntime: asset.tracksMachineDowntime },
      after: {
        name: updates.name ?? asset.name,
        assetId: updates.assetId ?? asset.assetId,
        tracksMachineDowntime: updates.tracksMachineDowntime ?? asset.tracksMachineDowntime,
      },
    },
  });

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
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(assets).where(eq(assets.id, id));
  await recordAuditLog({
    entityType: "asset",
    entityId: id,
    action: "deleted",
    userId: session.id,
    metadata: {
      name: asset.name,
      assetId: asset.assetId,
    },
  });

  return NextResponse.json({ ok: true });
}
