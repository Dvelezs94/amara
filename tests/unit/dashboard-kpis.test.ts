import { describe, expect, it } from "vitest";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";

describe("buildDashboardKpis machineDowntimeHours", () => {
  const completedRow = {
    status: "completed",
    kind: "on_demand" as const,
    createdAt: new Date("2026-01-01T09:00:00Z"),
    completedAt: new Date("2026-01-01T12:00:00Z"),
    startedAt: new Date("2026-01-01T10:00:00Z"),
    assetId: "a1",
    countsMachineDowntime: true,
    manualDowntimeMinutes: 0,
    assetTracksMachineDowntime: true,
  };

  it("sums automatic downtime when asset allows tracking", () => {
    const kpis = buildDashboardKpis({
      workOrders: [completedRow],
      assetCount: 1,
    });
    expect(kpis.machineDowntimeHours).toBe(2);
  });

  it("excludes downtime when asset opted out", () => {
    const kpis = buildDashboardKpis({
      workOrders: [{ ...completedRow, assetTracksMachineDowntime: false }],
      assetCount: 1,
    });
    expect(kpis.machineDowntimeHours).toBe(0);
  });

  it("includes manual minutes when effective flag is on", () => {
    const kpis = buildDashboardKpis({
      workOrders: [{ ...completedRow, manualDowntimeMinutes: 30 }],
      assetCount: 1,
    });
    expect(kpis.machineDowntimeHours).toBe(2.5);
  });
});
