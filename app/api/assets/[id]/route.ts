import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { workOrders } from "@/lib/db/schema";
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
