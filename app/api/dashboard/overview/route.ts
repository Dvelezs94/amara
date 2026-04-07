import { NextResponse } from "next/server";
import { and, asc, gte, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assets,
  maintenanceSchedules,
  workOrders,
  users,
} from "@/lib/db/schema";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";

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

  const upcomingWithAssigneePromise = db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      nextRunAt: maintenanceSchedules.nextRunAt,
      assetName: assets.name,
      assigneeName: users.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(assets, sql`${maintenanceSchedules.assetId} = ${assets.id}`)
    .leftJoin(users, sql`${maintenanceSchedules.assigneeId} = ${users.id}`)
    .where(
      and(
        sql`${maintenanceSchedules.nextRunAt} IS NOT NULL`,
        gte(maintenanceSchedules.nextRunAt, now)
      )
    )
    .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name))
    .limit(6);

  const [pendingOrders, upcomingEvents] = await Promise.all([
    pendingOrdersPromise,
    upcomingWithAssigneePromise.catch(async (error) => {
      if (!isMissingAssigneeColumnError(error)) throw error;
      const fallbackUpcoming = await db
        .select({
          id: maintenanceSchedules.id,
          name: maintenanceSchedules.name,
          nextRunAt: maintenanceSchedules.nextRunAt,
          assetName: assets.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(assets, sql`${maintenanceSchedules.assetId} = ${assets.id}`)
        .where(
          and(
            sql`${maintenanceSchedules.nextRunAt} IS NOT NULL`,
            gte(maintenanceSchedules.nextRunAt, now)
          )
        )
        .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name))
        .limit(6);
      return fallbackUpcoming.map((item) => ({
        ...item,
        assigneeName: null,
      }));
    }),
  ]);

  const [recentWorkOrders, totalAssets] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        status: workOrders.status,
        requesterId: workOrders.requesterId,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        description: workOrders.description,
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
    upcomingEvents: upcomingEvents.map((item) => ({
      ...item,
      nextRunAt: item.nextRunAt ? item.nextRunAt.toISOString() : null,
    })),
    kpis,
  });
}
