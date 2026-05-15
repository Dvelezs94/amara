import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { maintenanceSchedules } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(maintenanceSchedules.id, id),
      isNotNull(maintenanceSchedules.deletedAt)
    ),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(maintenanceSchedules)
    .set({ deletedAt: null })
    .where(eq(maintenanceSchedules.id, id));

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: id,
    action: "restored",
    userId: session.id,
    metadata: { scheduleName: row.name },
  });

  return NextResponse.json({ ok: true });
}
