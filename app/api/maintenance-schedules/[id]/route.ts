import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceSchedules, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await db.query.maintenanceSchedules.findFirst({
    where: eq(maintenanceSchedules.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.assigneeId !== undefined) {
    const assigneeId =
      body.assigneeId === null || body.assigneeId === ""
        ? null
        : String(body.assigneeId);
    if (assigneeId) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, assigneeId),
      });
      if (!u) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 400 }
        );
      }
    }
    const previousAssignee = row.assigneeId;
    if (previousAssignee !== assigneeId) {
      await db
        .update(maintenanceSchedules)
        .set({ assigneeId })
        .where(eq(maintenanceSchedules.id, id));

      await recordAuditLog({
        entityType: "maintenance_schedule",
        entityId: id,
        action: "assignee_updated",
        userId: session.id,
        metadata: {
          scheduleName: row.name,
          before: { assigneeId: previousAssignee },
          after: { assigneeId },
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
