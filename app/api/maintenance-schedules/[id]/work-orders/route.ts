import { NextResponse } from "next/server";
import { desc, like } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rows = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(
      like(
        workOrders.description,
        `%calendario de mantenimiento (${id})%`
      )
    )
    .orderBy(desc(workOrders.createdAt));

  return NextResponse.json(rows);
}
