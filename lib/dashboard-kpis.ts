type WorkOrderKpiRow = {
  status: string;
  requesterId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  description: string | null;
};

export type DashboardKpis = {
  mttrHours: number;
  downtimeHours: number;
  plannedCount: number;
  unplannedCount: number;
  plannedPct: number;
  oee: number;
  windowDays: number;
};

/**
 * Centralized KPI calculator for dashboard cards.
 * Keep dashboard KPI business rules in one place.
 */
export function buildDashboardKpis({
  workOrders,
  assetCount,
  windowDays = 30,
}: {
  workOrders: WorkOrderKpiRow[];
  assetCount: number;
  windowDays?: number;
}): DashboardKpis {
  const completedWithTimes = workOrders.filter(
    (wo) => wo.status === "completed" && wo.completedAt && wo.createdAt
  );

  const totalRepairHours = completedWithTimes.reduce((acc, wo) => {
    const diff = wo.completedAt!.getTime() - wo.createdAt.getTime();
    return acc + Math.max(0, diff / 3_600_000);
  }, 0);

  const mttrHours =
    completedWithTimes.length > 0 ? totalRepairHours / completedWithTimes.length : 0;
  const downtimeHours = totalRepairHours;

  const unplannedCount = workOrders.filter(
    (wo) =>
      wo.requesterId != null ||
      (wo.description ?? "").includes("Solicitud externa desde /solicitud")
  ).length;
  const plannedCount = Math.max(0, workOrders.length - unplannedCount);
  const totalPlanned = plannedCount + unplannedCount;
  const plannedPct = totalPlanned > 0 ? (plannedCount / totalPlanned) * 100 : 0;

  const periodHours = windowDays * 24;
  const availability =
    assetCount > 0
      ? Math.max(
          0,
          Math.min(1, 1 - downtimeHours / Math.max(1, assetCount * periodHours))
        )
      : 0;
  const oee = availability * 100;

  return {
    mttrHours: Number(mttrHours.toFixed(1)),
    downtimeHours: Number(downtimeHours.toFixed(1)),
    plannedCount,
    unplannedCount,
    plannedPct: Number(plannedPct.toFixed(1)),
    oee: Number(oee.toFixed(1)),
    windowDays,
  };
}
