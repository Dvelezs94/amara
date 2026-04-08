import { NextResponse } from "next/server";
import { asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assets,
  maintenanceSchedules,
  workOrders,
  users,
} from "@/lib/db/schema";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";
import { resolveNextMaintenanceDisplayDate } from "@/lib/maintenance-recurrence";

function isMissingAssigneeColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.assignee_id") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);

  const pendingOrdersPromise = db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      dueDate: workOrders.dueDate,
      priority: workOrders.priority,
      kind: workOrders.kind,
      assetName: assets.name,
    })
    .from(workOrders)
    .leftJoin(assets, sql`${workOrders.assetId} = ${assets.id}`)
    .where(inArray(workOrders.status, ["open", "in_progress"]))
    .orderBy(asc(workOrders.dueDate), asc(workOrders.createdAt))
    .limit(6);

  async function fetchScheduleRowsForUpcoming(): Promise<
    Array<{
      id: string;
      name: string;
      recurrence: string;
      nextRunAt: Date | null;
      assetName: string | null;
      assigneeName: string | null;
    }>
  > {
    try {
      return await db
        .select({
          id: maintenanceSchedules.id,
          name: maintenanceSchedules.name,
          recurrence: maintenanceSchedules.recurrence,
          nextRunAt: maintenanceSchedules.nextRunAt,
          assetName: assets.name,
          assigneeName: users.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
        .leftJoin(users, eq(maintenanceSchedules.assigneeId, users.id));
    } catch (error) {
      if (!isMissingAssigneeColumnError(error)) throw error;
      const rows = await db
        .select({
          id: maintenanceSchedules.id,
          name: maintenanceSchedules.name,
          recurrence: maintenanceSchedules.recurrence,
          nextRunAt: maintenanceSchedules.nextRunAt,
          assetName: assets.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id));
      return rows.map((r) => ({ ...r, assigneeName: null as string | null }));
    }
  }

  const upcomingRowsPromise = fetchScheduleRowsForUpcoming();

  const [pendingOrders, scheduleRows] = await Promise.all([
    pendingOrdersPromise,
    upcomingRowsPromise,
  ]);

  const upcomingEvents = scheduleRows
    .map((row) => {
      const displayNext = resolveNextMaintenanceDisplayDate(
        row.recurrence,
        row.nextRunAt,
        now
      );
      return { row, displayNext };
    })
    .filter((x): x is typeof x & { displayNext: Date } => x.displayNext != null)
    .sort((a, b) => a.displayNext.getTime() - b.displayNext.getTime())
    .slice(0, 6)
    .map(({ row, displayNext }) => ({
      id: row.id,
      name: row.name,
      nextRunAt: displayNext.toISOString(),
      assetName: row.assetName,
      assigneeName: row.assigneeName,
    }));

  const [recentWorkOrders, totalAssets] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        status: workOrders.status,
        kind: workOrders.kind,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
      })
      .from(workOrders)
      .where(gte(workOrders.createdAt, periodStart)),
    db.select({ count: sql<number>`count(*)` }).from(assets),
  ]);

  const assetCount = Number(totalAssets[0]?.count ?? 0);
  const kpis = buildDashboardKpis({
    workOrders: recentWorkOrders,
    assetCount,
    windowDays: 30,
  });

  return NextResponse.json({
    pendingOrders: pendingOrders.map((item) => ({
      ...item,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    })),
    upcomingEvents,
    kpis,
  });
}
