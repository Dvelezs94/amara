import { NextResponse } from "next/server";
import { and, gte, lte, like, not, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";

function toYmdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from/to requeridos" }, { status: 400 });
  }

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Rango inválido" }, { status: 400 });
  }

  const rows = await db
    .select({
      description: workOrders.description,
      dueDate: workOrders.dueDate,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(
      and(
        not(isNull(workOrders.dueDate)),
        gte(workOrders.dueDate, fromDate),
        lte(workOrders.dueDate, toDate),
        like(workOrders.description, `%calendario de mantenimiento (%`)
      )
    );

  const markers: Record<string, string> = {};
  for (const row of rows) {
    if (!row.description || !row.dueDate) continue;
    const match = row.description.match(/calendario de mantenimiento \(([^)]+)\)/i);
    const scheduleId = match?.[1];
    if (!scheduleId) continue;
    const ymd = toYmdLocal(new Date(row.dueDate));
    markers[`${scheduleId}|${ymd}`] = row.status;
  }

  return NextResponse.json({ markers });
}
