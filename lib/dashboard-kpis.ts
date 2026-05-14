import {
  effectiveCountsMachineDowntime,
  workOrderTotalDowntimeMinutesForAsset,
} from "@/lib/machine-downtime";

type WorkOrderKpiRow = {
  status: string;
  /** routine = planificado; on_demand u otro = no planificado */
  kind?: string | null;
  createdAt: Date;
  completedAt: Date | null;
  startedAt?: Date | null;
  assetId?: string | null;
  countsMachineDowntime?: boolean;
  manualDowntimeMinutes?: number | null;
  /** Desde `assets`; null si la tarea no tiene activo o join ausente */
  assetTracksMachineDowntime?: boolean | null;
};

export type DashboardKpis = {
  mttrHours: number | null;
  /** Horas acumuladas de reparación (completadas en la ventana). */
  downtimeHours: number;
  /** Horas de paro de máquina (intervalo en curso→terminada + manual), solo activos con seguimiento activado. */
  machineDowntimeHours: number;
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

  let machineDowntimeMinutes = 0;
  for (const wo of workOrders) {
    const counts = effectiveCountsMachineDowntime(
      wo.countsMachineDowntime,
      wo.assetTracksMachineDowntime
    );
    machineDowntimeMinutes += workOrderTotalDowntimeMinutesForAsset({
      status: wo.status,
      assetId: wo.assetId ?? null,
      countsMachineDowntime: counts,
      startedAt: wo.startedAt,
      completedAt: wo.completedAt,
      manualDowntimeMinutes: wo.manualDowntimeMinutes,
    });
  }
  const machineDowntimeHours = Number((machineDowntimeMinutes / 60).toFixed(1));

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

  const periodHours = Math.max(1, windowDays) * 24;
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
    machineDowntimeHours,
    plannedCount,
    unplannedCount,
    plannedPct,
    oee,
    windowDays,
  };
}
