import { describe, expect, it } from "vitest";
import {
  DASHBOARD_KPI_CARDS,
  dashboardEmptyCopy,
  formatDashboardContextBanner,
  moveDashboardBlock,
  parseDashboardBlockOrder,
} from "@/lib/dashboard-presentation";

describe("DASHBOARD_KPI_CARDS", () => {
  it("defines five KPIs with tones", () => {
    expect(DASHBOARD_KPI_CARDS).toHaveLength(5);
    expect(DASHBOARD_KPI_CARDS.map((c) => c.id)).toEqual([
      "mttr",
      "inactividad",
      "paro",
      "planificado",
      "oee",
    ]);
    expect(DASHBOARD_KPI_CARDS.find((c) => c.id === "paro")?.tone).toBe("accent");
    expect(DASHBOARD_KPI_CARDS.find((c) => c.id === "oee")?.tone).toBe("primary");
  });
});

describe("dashboardEmptyCopy", () => {
  it("points empty states to related app routes", () => {
    expect(dashboardEmptyCopy.tareas.href).toBe("/tareas");
    expect(dashboardEmptyCopy.eventos.href).toBe("/calendario");
    expect(dashboardEmptyCopy.checklists.href).toBe("/checklists");
    expect(dashboardEmptyCopy.tareas.message.length).toBeGreaterThan(10);
  });
});

describe("formatDashboardContextBanner", () => {
  it("describes a 30-day window with from–to", () => {
    expect(
      formatDashboardContextBanner({
        from: "2026-08-05",
        to: "2026-09-03",
        windowDays: 30,
      })
    ).toBe("Ventana de 30 días (2026-08-05 – 2026-09-03)");
  });

  it("describes a single day", () => {
    expect(
      formatDashboardContextBanner({
        from: "2026-09-03",
        to: "2026-09-03",
        windowDays: 1,
      })
    ).toBe("Ventana de 1 día (2026-09-03)");
  });
});

describe("parseDashboardBlockOrder", () => {
  it("returns the default catalog for invalid input", () => {
    expect(parseDashboardBlockOrder(null)).toEqual([
      "kpis",
      "lists",
      "checklists",
      "charts",
    ]);
  });

  it("keeps a custom order and appends missing blocks", () => {
    expect(parseDashboardBlockOrder(["charts", "kpis", "unknown"])).toEqual([
      "charts",
      "kpis",
      "lists",
      "checklists",
    ]);
  });
});

describe("moveDashboardBlock", () => {
  it("moves a block to another index", () => {
    expect(moveDashboardBlock(["kpis", "lists", "checklists", "charts"], 0, 2)).toEqual([
      "lists",
      "checklists",
      "kpis",
      "charts",
    ]);
  });
});
