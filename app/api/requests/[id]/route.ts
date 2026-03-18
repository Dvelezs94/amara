import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const req = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  if (!req) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [requester, asset] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, req.requesterId),
      columns: { id: true, name: true, email: true },
    }),
    req.assetId
      ? db.query.assets.findFirst({
          where: eq(assets.id, req.assetId),
          columns: { id: true, name: true, assetId: true },
        })
      : null,
  ]);
  return NextResponse.json({
    ...req,
    requester: requester ?? null,
    asset: asset ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const r = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  if (!r) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (r.status !== "pending") {
    return NextResponse.json(
      { error: "Request already converted or cancelled" },
      { status: 400 }
    );
  }
  const body = await req.json().catch(() => ({}));
  if (body.action === "convert") {
    const woId = createId();
    const now = new Date();
    await db.insert(workOrders).values({
      id: woId,
      title: r.description.slice(0, 200),
      description: r.description,
      status: "open",
      priority: "medium",
      assetId: r.assetId,
      requesterId: r.requesterId,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .update(requests)
      .set({ status: "converted", workOrderId: woId })
      .where(eq(requests.id, id));
    return NextResponse.json({ workOrderId: woId });
  }
  if (body.action === "cancel") {
    await db
      .update(requests)
      .set({ status: "cancelled" })
      .where(eq(requests.id, id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
