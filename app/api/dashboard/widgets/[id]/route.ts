import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { parseChartTypeFromRequest } from "@/lib/dashboard-widget-chart-type";
import { parseChartThresholds } from "@/lib/chart-thresholds";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    chartType?: unknown;
    thresholds?: unknown;
    chartTitle?: unknown;
  };
  const updates: Partial<typeof dashboardWidgets.$inferInsert> = {};
  if (body.chartType !== undefined) {
    updates.chartType = parseChartTypeFromRequest(body.chartType);
  }
  if (body.thresholds !== undefined) {
    updates.thresholds = parseChartThresholds(body.thresholds);
  }
  if (body.chartTitle !== undefined) {
    const trimmed =
      body.chartTitle != null && String(body.chartTitle).trim()
        ? String(body.chartTitle).trim().slice(0, 200)
        : null;
    updates.chartTitle = trimmed;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  const updated = await db
    .update(dashboardWidgets)
    .set(updates)
    .where(and(eq(dashboardWidgets.id, id), eq(dashboardWidgets.userId, session.id)))
    .returning({
      id: dashboardWidgets.id,
      chartType: dashboardWidgets.chartType,
      thresholds: dashboardWidgets.thresholds,
      chartTitle: dashboardWidgets.chartTitle,
    });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    chartType: updated[0]!.chartType,
    thresholds: updated[0]!.thresholds,
    chartTitle: updated[0]!.chartTitle,
  });
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
