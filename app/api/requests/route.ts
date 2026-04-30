import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const base = db
    .select({
      id: requests.id,
      description: requests.description,
      priority: requests.priority,
      status: requests.status,
      workOrderId: requests.workOrderId,
      createdAt: requests.createdAt,
      assetId: requests.assetId,
      requesterName: users.name,
      assetName: assets.name,
    })
    .from(requests)
    .leftJoin(users, eq(requests.requesterId, users.id))
    .leftJoin(assets, eq(requests.assetId, assets.id))
    .orderBy(desc(requests.createdAt));

  const list = status
    ? await base.where(eq(requests.status, status as "pending" | "converted" | "cancelled"))
    : await base;

  return NextResponse.json(list);
}

export async function POST() {
  return NextResponse.json(
    { error: "Las ordenes nuevas solo se crean desde /orden" },
    { status: 403 }
  );
}
