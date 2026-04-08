type WorkOrderKpiRow = {
  status: string;
  /** routine = planificado; on_demand u otro = no planificado */
  kind?: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type DashboardKpis = {
  mttrHours: number | null;
  /** Horas acumuladas de reparación (completadas en la ventana). */
  downtimeHours: number;
  plannedCount: number;
  unplannedCount: number;
  plannedPct: number | null;
  oee: number | null;
  windowDays: number;
};

/**
 * KPIs del dashboard (ventana móvil de work orders por fecha de creación).
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
    (wo) => wo.status === "completed" && wo.completedAt != null && wo.createdAt != null
  );

  const totalRepairHours = completedWithTimes.reduce((acc, wo) => {
    const diff = wo.completedAt!.getTime() - wo.createdAt.getTime();
    return acc + Math.max(0, diff / 3_600_000);
  }, 0);

  const downtimeHours = Number(totalRepairHours.toFixed(1));

  const mttrHours =
    completedWithTimes.length > 0
      ? Number((totalRepairHours / completedWithTimes.length).toFixed(1))
      : null;

  const plannedCount = workOrders.filter((wo) => wo.kind === "routine").length;
  const unplannedCount = Math.max(0, workOrders.length - plannedCount);
  const totalPlanned = workOrders.length;
  const plannedPct =
    totalPlanned > 0
      ? Number(((plannedCount / totalPlanned) * 100).toFixed(1))
      : null;

  const periodHours = windowDays * 24;
  let oee: number | null = null;
  if (assetCount > 0) {
    const availability = Math.max(
      0,
      Math.min(1, 1 - downtimeHours / Math.max(1, assetCount * periodHours))
    );
    oee = Number((availability * 100).toFixed(1));
  }

  return {
    mttrHours,
    downtimeHours,
    plannedCount,
    unplannedCount,
    plannedPct,
    oee,
    windowDays,
  };
}
