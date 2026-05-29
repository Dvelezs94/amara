import { describe, expect, it } from "vitest";
import {
  dayBoundsFromYmd,
  dueDateFromYmd,
  maintenanceScheduleWorkOrderDescription,
  parseScheduleYmd,
  scheduleWorkOrderMarkerKey,
  workOrderStatusMarkerLabel,
} from "@/lib/maintenance-schedule-work-order";
import { workOrderStatusMarkerColor } from "@/lib/work-order-status-colors";

describe("maintenance-schedule-work-order helpers", () => {
  it("builds stable description and marker key", () => {
    expect(maintenanceScheduleWorkOrderDescription("sched-1")).toBe(
      "Generada desde calendario de mantenimiento (sched-1)."
    );
    expect(scheduleWorkOrderMarkerKey("sched-1", "2026-04-23")).toBe(
      "sched-1|2026-04-23"
    );
  });

  it("maps work order status to marker colors", () => {
    expect(workOrderStatusMarkerColor("pending")).toBe("#fbbf24");
    expect(workOrderStatusMarkerColor("completed")).toBe("#86efac");
    expect(workOrderStatusMarkerLabel("in_progress")).toBe("Tarea en progreso");
  });

  it("parses YMD and day bounds", () => {
    expect(parseScheduleYmd("2026-04-23")).toBe("2026-04-23");
    expect(parseScheduleYmd("bad")).toBeNull();
    const bounds = dayBoundsFromYmd("2026-04-23");
    expect(bounds).not.toBeNull();
    expect(dueDateFromYmd("2026-04-23")?.getTime()).toBe(bounds!.start.getTime());
  });
});
