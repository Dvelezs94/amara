import { NextResponse } from "next/server";
import { and, gte, lte, like, not, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import {
  CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE,
  buildCalendarWorkOrderMarkers,
} from "@/lib/maintenance-schedule-work-order";
import { toYmdLocal } from "@/lib/maintenance-recurrence";

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
        like(
          workOrders.description,
          CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE
        )
      )
    );

  return NextResponse.json({
    markers: buildCalendarWorkOrderMarkers(rows, toYmdLocal),
  });
}
