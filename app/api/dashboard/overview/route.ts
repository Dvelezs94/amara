import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assets,
  maintenanceSchedules,
  workOrders,
  users,
} from "@/lib/db/schema";
import {
  clampRangeOrder,
  defaultLast30DaysRange,
  endOfLocalDayFromYmd,
  inclusiveLocalDayCount,
  isValidYmd,
  startOfLocalDayFromYmd,
} from "@/lib/dashboard-date-range";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";
import { resolveNextMaintenanceDisplayDate } from "@/lib/maintenance-recurrence";
import { loadManyMaintenanceScheduleAssigneeIds } from "@/lib/assignees";

function isMissingAssigneeColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("maintenance_schedules.assignee_id") &&
    (message.includes("no such column") || message.includes("has no column named"))
  );
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const includeLists = searchParams.get("includeLists") !== "0";

  const fallback = defaultLast30DaysRange();
  let fromYmd =
    fromParam && isValidYmd(fromParam) ? fromParam : fallback.from;
  let toYmd = toParam && isValidYmd(toParam) ? toParam : fallback.to;
  ({ from: fromYmd, to: toYmd } = clampRangeOrder(fromYmd, toYmd));

  const rangeStart = startOfLocalDayFromYmd(fromYmd);
  const rangeEnd = endOfLocalDayFromYmd(toYmd);
  const windowDays = inclusiveLocalDayCount(fromYmd, toYmd);
  const now = new Date();

  const pendingOrdersPromise = includeLists
    ? db
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
    .where(inArray(workOrders.status, ["pending", "in_progress"]))
    .orderBy(asc(workOrders.dueDate), asc(workOrders.createdAt))
    .limit(50)
    : Promise.resolve([]);

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
    async function enrichWithAssigneeNames(
      rows: Array<{
        id: string;
        name: string;
        recurrence: string;
        nextRunAt: Date | null;
        assetName: string | null;
        legacyAssigneeId: string | null;
      }>
    ) {
      const scheduleIds = rows.map((r) => r.id);
      const junctionMap = await loadManyMaintenanceScheduleAssigneeIds(scheduleIds);
      const allUserIds = new Set<string>();
      for (const r of rows) {
        let ids = junctionMap.get(r.id) ?? [];
        if (ids.length === 0 && r.legacyAssigneeId) ids = [r.legacyAssigneeId];
        for (const id of ids) allUserIds.add(id);
      }
      let nameById = new Map<string, string>();
      if (allUserIds.size > 0) {
        const userRows = await db.query.users.findMany({
          where: inArray(users.id, Array.from(allUserIds)),
          columns: { id: true, name: true },
        });
        nameById = new Map(userRows.map((u) => [u.id, u.name]));
      }
      return rows.map((r) => {
        let ids = junctionMap.get(r.id) ?? [];
        if (ids.length === 0 && r.legacyAssigneeId) ids = [r.legacyAssigneeId];
        const names = ids
          .map((id) => nameById.get(id))
          .filter((n): n is string => Boolean(n));
        return {
          id: r.id,
          name: r.name,
          recurrence: r.recurrence,
          nextRunAt: r.nextRunAt,
          assetName: r.assetName,
          assigneeName: names.length > 0 ? names.join(", ") : null,
        };
      });
    }

    try {
      const rows = await db
        .select({
          id: maintenanceSchedules.id,
          name: maintenanceSchedules.name,
          recurrence: maintenanceSchedules.recurrence,
          nextRunAt: maintenanceSchedules.nextRunAt,
          assetName: assets.name,
          legacyAssigneeId: maintenanceSchedules.assigneeId,
        })
        .from(maintenanceSchedules)
        .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
        .where(isNull(maintenanceSchedules.deletedAt));
      return enrichWithAssigneeNames(rows);
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
        .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
        .where(isNull(maintenanceSchedules.deletedAt));
      return enrichWithAssigneeNames(
        rows.map((r) => ({ ...r, legacyAssigneeId: null as string | null }))
      );
    }
  }

  const upcomingRowsPromise = includeLists
    ? fetchScheduleRowsForUpcoming()
    : Promise.resolve([]);

  const [pendingOrders, scheduleRows] = await Promise.all([
    pendingOrdersPromise,
    upcomingRowsPromise,
  ]);

  const upcomingEvents = includeLists
    ? scheduleRows
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
    .slice(0, 50)
    .map(({ row, displayNext }) => ({
      id: row.id,
      name: row.name,
      nextRunAt: displayNext.toISOString(),
      assetName: row.assetName,
      assigneeName: row.assigneeName,
    }))
    : [];

  const [recentWorkOrders, totalAssets] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        status: workOrders.status,
        kind: workOrders.kind,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        startedAt: workOrders.startedAt,
        assetId: workOrders.assetId,
        countsMachineDowntime: workOrders.countsMachineDowntime,
        manualDowntimeMinutes: workOrders.manualDowntimeMinutes,
        assetTracksMachineDowntime: assets.tracksMachineDowntime,
      })
      .from(workOrders)
      .leftJoin(assets, eq(workOrders.assetId, assets.id))
      .where(
        and(
          gte(workOrders.createdAt, rangeStart),
          lte(workOrders.createdAt, rangeEnd)
        )
      ),
    db.select({ count: sql<number>`count(*)` }).from(assets),
  ]);

  const assetCount = Number(totalAssets[0]?.count ?? 0);
  const kpis = buildDashboardKpis({
    workOrders: recentWorkOrders,
    assetCount,
    windowDays,
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
