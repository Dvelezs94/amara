import { NextResponse } from "next/server";
import { desc, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceSchedules } from "@/lib/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      deletedAt: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(isNotNull(maintenanceSchedules.deletedAt))
    .orderBy(desc(maintenanceSchedules.deletedAt))
    .limit(40);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      deletedAt: r.deletedAt?.toISOString() ?? null,
    })),
  });
}
