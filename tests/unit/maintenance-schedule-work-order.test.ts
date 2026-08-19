import { describe, expect, it } from "vitest";
import {
  dayBoundsFromYmd,
  dueDateFromYmd,
  maintenanceScheduleWorkOrderDescription,
  parseCalendarEventSearchParams,
  parseMaintenanceScheduleWorkOrderDescription,
  parseScheduleYmd,
  scheduleWorkOrderMarkerKey,
  workOrderStatusMarkerLabel,
  calendarEventHref,
} from "@/lib/maintenance-schedule-work-order";
import { workOrderStatusMarkerColor } from "@/lib/work-order-status-colors";

describe("maintenance-schedule-work-order helpers", () => {
  it("builds stable description and marker key", () => {
    expect(maintenanceScheduleWorkOrderDescription("sched-1")).toBe(
      "Generada desde calendario de mantenimiento (sched-1)."
    );
    expect(
      maintenanceScheduleWorkOrderDescription("sched-1", "Lubricación")
    ).toBe(
      "Generada desde calendario de mantenimiento: Lubricación (sched-1)."
    );
    expect(scheduleWorkOrderMarkerKey("sched-1", "2026-04-23")).toBe(
      "sched-1|2026-04-23"
    );
  });

  it("parses calendar-generated descriptions and deep-link hrefs", () => {
    expect(
      parseMaintenanceScheduleWorkOrderDescription(
        "Generada desde calendario de mantenimiento: Prensa 3 (ms_abc)."
      )
    ).toEqual({ name: "Prensa 3", scheduleId: "ms_abc" });
    expect(
      parseMaintenanceScheduleWorkOrderDescription(
        "Generada desde calendario de mantenimiento (ms_abc)."
      )
    ).toEqual({ name: null, scheduleId: "ms_abc" });
    expect(parseMaintenanceScheduleWorkOrderDescription("Otra cosa")).toBeNull();
    expect(calendarEventHref("ms_abc", "2026-08-12")).toBe(
      "/calendario?evento=ms_abc&fecha=2026-08-12"
    );
    expect(
      parseCalendarEventSearchParams({
        evento: "ms_abc",
        fecha: "2026-08-12",
      })
    ).toEqual({ scheduleId: "ms_abc", dateYmd: "2026-08-12" });
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
