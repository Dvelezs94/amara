import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { parseChartTypeFromRequest } from "@/lib/dashboard-widget-chart-type";
import { parseChartThresholds } from "@/lib/chart-thresholds";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db.query.dashboardWidgets.findMany({
    where: eq(dashboardWidgets.userId, session.id),
    orderBy: [asc(dashboardWidgets.sortOrder), asc(dashboardWidgets.createdAt)],
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const {
    templateId,
    templateName,
    fieldLabel,
    fieldLabels: rawFieldLabels,
    dateFrom,
    dateTo,
    chartType: rawChartType,
    thresholds: rawThresholds,
    chartTitle: rawChartTitle,
  } = body as {
    templateId?: unknown;
    templateName?: unknown;
    fieldLabel?: unknown;
    fieldLabels?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
    chartType?: unknown;
    thresholds?: unknown;
    chartTitle?: unknown;
  };
  const fromArray = Array.isArray(rawFieldLabels)
    ? rawFieldLabels.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const fieldLabels =
    fromArray.length > 0
      ? Array.from(new Set(fromArray))
      : fieldLabel != null && String(fieldLabel).trim()
        ? [String(fieldLabel).trim()]
        : [];
  if (!templateId || !templateName || fieldLabels.length === 0) {
    return NextResponse.json(
      { error: "templateId, templateName y al menos un campo (fieldLabels o fieldLabel) son obligatorios" },
      { status: 400 }
    );
  }
  const primaryLabel = fieldLabels[0]!;
  const chartType = parseChartTypeFromRequest(rawChartType);
  const thresholds = parseChartThresholds(rawThresholds);
  const chartTitle =
    rawChartTitle != null && String(rawChartTitle).trim()
      ? String(rawChartTitle).trim().slice(0, 200)
      : null;
  const maxOrder = await db
    .select({ sortOrder: dashboardWidgets.sortOrder })
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.userId, session.id))
    .orderBy(desc(dashboardWidgets.sortOrder))
    .limit(1);
  const sortOrder = (maxOrder[0]?.sortOrder ?? -1) + 1;

  const id = createId();
  await db.insert(dashboardWidgets).values({
    id,
    userId: session.id,
    templateId: String(templateId).trim(),
    templateName: String(templateName).trim(),
    fieldLabel: primaryLabel,
    fieldLabels,
    chartType,
    thresholds,
    chartTitle,
    dateFrom: dateFrom != null ? String(dateFrom).slice(0, 10) : null,
    dateTo: dateTo != null ? String(dateTo).slice(0, 10) : null,
    sortOrder,
  });
  return NextResponse.json({ id, sortOrder });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { widgetIds } = body;
  if (!Array.isArray(widgetIds) || widgetIds.length === 0) {
    return NextResponse.json(
      { error: "widgetIds debe ser un array no vacío" },
      { status: 400 }
    );
  }
  const mine = await db.query.dashboardWidgets.findMany({
    where: eq(dashboardWidgets.userId, session.id),
    columns: { id: true },
  });
  const myIds = new Set(mine.map((w) => w.id));
  for (let i = 0; i < widgetIds.length; i++) {
    const id = widgetIds[i];
    if (!myIds.has(id)) continue;
    await db
      .update(dashboardWidgets)
      .set({ sortOrder: i })
      .where(eq(dashboardWidgets.id, id));
  }
  return NextResponse.json({ ok: true });
}
