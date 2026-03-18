import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { createId } from "@/lib/id";

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
  const { templateId, templateName, fieldLabel, dateFrom, dateTo } = body;
  if (!templateId || !templateName || !fieldLabel) {
    return NextResponse.json(
      { error: "templateId, templateName y fieldLabel son obligatorios" },
      { status: 400 }
    );
  }
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
    fieldLabel: String(fieldLabel).trim(),
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
