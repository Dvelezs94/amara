import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { parseChartTypeFromRequest } from "@/lib/dashboard-widget-chart-type";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const chartType = parseChartTypeFromRequest(
    (body as { chartType?: unknown }).chartType
  );
  const updated = await db
    .update(dashboardWidgets)
    .set({ chartType })
    .where(and(eq(dashboardWidgets.id, id), eq(dashboardWidgets.userId, session.id)))
    .returning({ id: dashboardWidgets.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, chartType });
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
