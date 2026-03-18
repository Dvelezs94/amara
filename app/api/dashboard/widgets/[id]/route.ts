import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db
    .delete(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.id, id),
        eq(dashboardWidgets.userId, session.id)
      )
    );
  return NextResponse.json({ ok: true });
}
