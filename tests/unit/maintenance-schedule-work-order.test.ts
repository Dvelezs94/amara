import { describe, expect, it } from "vitest";
import {
  CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE,
  buildCalendarWorkOrderMarkers,
  calendarEventHref,
  dayBoundsFromYmd,
  dueDateFromYmd,
  maintenanceScheduleWorkOrderDescription,
  maintenanceScheduleWorkOrderDescriptionPattern,
  parseCalendarEventSearchParams,
  parseMaintenanceScheduleWorkOrderDescription,
  parseScheduleYmd,
  scheduleWorkOrderMarkerKey,
  workOrderMatchesScheduleDay,
  workOrderStatusMarkerLabel,
} from "@/lib/maintenance-schedule-work-order";
import { workOrderStatusMarkerColor } from "@/lib/work-order-status-colors";
import { toYmdLocal } from "@/lib/maintenance-recurrence";

/** Minimal LIKE check: % → .* (calendar descriptions have no other wildcards). */
function likeMatches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/%/g, ".*")}$`, "i").test(value);
}

describe("maintenanceScheduleWorkOrderDescription", () => {
  it("writes legacy copy when the event has no name", () => {
    expect(maintenanceScheduleWorkOrderDescription("sched-1")).toBe(
      "Generada desde calendario de mantenimiento (sched-1)."
    );
    expect(maintenanceScheduleWorkOrderDescription("sched-1", "  ")).toBe(
      "Generada desde calendario de mantenimiento (sched-1)."
    );
  });

  it("writes named copy when Crear tarea runs from a calendar event", () => {
    expect(
      maintenanceScheduleWorkOrderDescription("ms_abc", "Lubricación")
    ).toBe(
      "Generada desde calendario de mantenimiento: Lubricación (ms_abc)."
    );
  });
});

describe("SQL LIKE patterns for calendar-created tasks", () => {
  const scheduleId = "ms_abc";
  const named = maintenanceScheduleWorkOrderDescription(
    scheduleId,
    "Lubricación"
  );
  const legacy = maintenanceScheduleWorkOrderDescription(scheduleId);
  const byId = maintenanceScheduleWorkOrderDescriptionPattern(scheduleId);

  it("finds named and legacy tasks for a schedule (event panel / uniqueness)", () => {
    expect(likeMatches(byId, named)).toBe(true);
    expect(likeMatches(byId, legacy)).toBe(true);
    expect(
      likeMatches(
        byId,
        maintenanceScheduleWorkOrderDescription("other_id", "Otro")
      )
    ).toBe(false);
    expect(likeMatches(byId, "Tarea manual sin vínculo")).toBe(false);
  });

  it("bulk markers query matches any calendar-generated description", () => {
    expect(
      likeMatches(CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE, named)
    ).toBe(true);
    expect(
      likeMatches(CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE, legacy)
    ).toBe(true);
    expect(
      likeMatches(
        CALENDAR_GENERATED_WORK_ORDER_DESCRIPTION_LIKE,
        "Sin calendario"
      )
    ).toBe(false);
  });

  it("rejects the old buggy pattern that missed named event copy", () => {
    expect(likeMatches("%calendario de mantenimiento (%", named)).toBe(false);
    expect(likeMatches("%calendario de mantenimiento (%", legacy)).toBe(true);
  });
});

describe("parseMaintenanceScheduleWorkOrderDescription", () => {
  it("round-trips named and legacy create-work-order descriptions", () => {
    const named = maintenanceScheduleWorkOrderDescription(
      "ms_abc",
      "Prensa 3"
    );
    const legacy = maintenanceScheduleWorkOrderDescription("ms_abc");
    expect(parseMaintenanceScheduleWorkOrderDescription(named)).toEqual({
      name: "Prensa 3",
      scheduleId: "ms_abc",
    });
    expect(parseMaintenanceScheduleWorkOrderDescription(legacy)).toEqual({
      name: null,
      scheduleId: "ms_abc",
    });
  });

  it("ignores unrelated descriptions", () => {
    expect(parseMaintenanceScheduleWorkOrderDescription(null)).toBeNull();
    expect(parseMaintenanceScheduleWorkOrderDescription("")).toBeNull();
    expect(parseMaintenanceScheduleWorkOrderDescription("Otra cosa")).toBeNull();
  });
});

describe("buildCalendarWorkOrderMarkers", () => {
  it("maps named calendar-created tasks onto scheduleId|fecha status chips", () => {
    const due = dueDateFromYmd("2026-08-21")!;
    const markers = buildCalendarWorkOrderMarkers(
      [
        {
          description: maintenanceScheduleWorkOrderDescription(
            "ms_event",
            "Inspección semanal"
          ),
          dueDate: due,
          status: "pending",
        },
        {
          description: maintenanceScheduleWorkOrderDescription("ms_legacy"),
          dueDate: dueDateFromYmd("2026-08-22")!,
          status: "completed",
        },
        {
          description: "Tarea suelta",
          dueDate: due,
          status: "pending",
        },
        {
          description: maintenanceScheduleWorkOrderDescription("ms_bad_day", "X"),
          dueDate: null,
          status: "pending",
        },
      ],
      toYmdLocal
    );
    expect(markers).toEqual({
      [scheduleWorkOrderMarkerKey("ms_event", "2026-08-21")]: "pending",
      [scheduleWorkOrderMarkerKey("ms_legacy", "2026-08-22")]: "completed",
    });
  });

  it("keeps the last status when two tasks share the same event day", () => {
    const due = dueDateFromYmd("2026-08-21")!;
    const markers = buildCalendarWorkOrderMarkers(
      [
        {
          description: maintenanceScheduleWorkOrderDescription("ms_1", "A"),
          dueDate: due,
          status: "pending",
        },
        {
          description: maintenanceScheduleWorkOrderDescription("ms_1", "A"),
          dueDate: due,
          status: "in_progress",
        },
      ],
      toYmdLocal
    );
    expect(markers[scheduleWorkOrderMarkerKey("ms_1", "2026-08-21")]).toBe(
      "in_progress"
    );
  });
});

describe("workOrderMatchesScheduleDay", () => {
  const dateYmd = "2026-08-21";
  const due = dueDateFromYmd(dateYmd)!;

  it("links a named create-work-order task back to its calendar event day", () => {
    expect(
      workOrderMatchesScheduleDay({
        description: maintenanceScheduleWorkOrderDescription(
          "ms_event",
          "Cambio de filtro"
        ),
        dueDate: due,
        scheduleId: "ms_event",
        dateYmd,
        dueDateToYmd: toYmdLocal,
      })
    ).toBe(true);
  });

  it("rejects wrong schedule, wrong day, or non-calendar tasks", () => {
    expect(
      workOrderMatchesScheduleDay({
        description: maintenanceScheduleWorkOrderDescription(
          "ms_event",
          "Cambio de filtro"
        ),
        dueDate: due,
        scheduleId: "ms_other",
        dateYmd,
        dueDateToYmd: toYmdLocal,
      })
    ).toBe(false);
    expect(
      workOrderMatchesScheduleDay({
        description: maintenanceScheduleWorkOrderDescription(
          "ms_event",
          "Cambio de filtro"
        ),
        dueDate: dueDateFromYmd("2026-08-22")!,
        scheduleId: "ms_event",
        dateYmd,
        dueDateToYmd: toYmdLocal,
      })
    ).toBe(false);
    expect(
      workOrderMatchesScheduleDay({
        description: "Manual",
        dueDate: due,
        scheduleId: "ms_event",
        dateYmd,
        dueDateToYmd: toYmdLocal,
      })
    ).toBe(false);
  });
});

describe("calendar deep links and day bounds", () => {
  it("builds and parses evento/fecha query params", () => {
    expect(calendarEventHref("ms_abc", "2026-08-12")).toBe(
      "/calendario?evento=ms_abc&fecha=2026-08-12"
    );
    expect(calendarEventHref("ms_abc")).toBe("/calendario?evento=ms_abc");
    expect(
      parseCalendarEventSearchParams({
        evento: "ms_abc",
        fecha: "2026-08-12",
      })
    ).toEqual({ scheduleId: "ms_abc", dateYmd: "2026-08-12" });
    expect(
      parseCalendarEventSearchParams({ evento: "", fecha: "2026-08-12" })
    ).toBeNull();
  });

  it("parses YMD and day bounds used when creating a task for an event day", () => {
    expect(parseScheduleYmd("2026-04-23")).toBe("2026-04-23");
    expect(parseScheduleYmd("bad")).toBeNull();
    const bounds = dayBoundsFromYmd("2026-04-23");
    expect(bounds).not.toBeNull();
    expect(dueDateFromYmd("2026-04-23")?.getTime()).toBe(
      bounds!.start.getTime()
    );
    expect(toYmdLocal(dueDateFromYmd("2026-04-23")!)).toBe("2026-04-23");
  });
});

describe("work order status markers", () => {
  it("maps status to calendar chip colors and labels", () => {
    expect(workOrderStatusMarkerColor("pending")).toBe("#fbbf24");
    expect(workOrderStatusMarkerColor("completed")).toBe("#86efac");
    expect(workOrderStatusMarkerLabel("in_progress")).toBe("Tarea en progreso");
  });
});
