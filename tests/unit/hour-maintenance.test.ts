import { describe, expect, it } from "vitest";
import {
  buildHourMaintenanceRecurrence,
  formatHourMaintenancePreview,
  hourMaintenancePlanView,
  hourMaintenanceSchedulePayload,
  hourPlanTimingChanged,
  operatingHoursToDayInterval,
  parseEveryHours,
  parseHoursPerDay,
  parseHourMaintenancePlanFields,
  preserveHourPlanInRecurrence,
  defaultHourMaintenancePlanName,
  hourMaintenanceTriggerLabel,
  hourMaintenanceCreatedCalendarHref,
} from "@/lib/hour-maintenance";
import {
  formatRecurrenceLabel,
  parseRecurrence,
} from "@/lib/maintenance-recurrence";

describe("hourMaintenanceCreatedCalendarHref", () => {
  it("opens the calendar on the plan start date", () => {
    expect(
      hourMaintenanceCreatedCalendarHref({
        scheduleId: "ms_hour_1",
        startDate: "2026-08-20",
      })
    ).toBe("/calendario?evento=ms_hour_1&fecha=2026-08-20");
  });
});

describe("hourMaintenanceTriggerLabel", () => {
  it("shows the plan count when there is at least one plan", () => {
    expect(hourMaintenanceTriggerLabel(0)).toBe("Mto. por horas");
    expect(hourMaintenanceTriggerLabel(2)).toBe("Mto. por horas (2)");
    expect(hourMaintenanceTriggerLabel(-1)).toBe("Mto. por horas");
  });
});

describe("defaultHourMaintenancePlanName", () => {
  it("includes the machine name when present", () => {
    expect(defaultHourMaintenancePlanName("Prensa 1")).toBe(
      "Mantenimiento por horas — Prensa 1"
    );
    expect(defaultHourMaintenancePlanName("  ")).toBe("Mantenimiento por horas");
  });
});

describe("parseHoursPerDay / parseEveryHours", () => {
  it("accepts positive hours and rejects invalid values", () => {
    expect(parseHoursPerDay(8)).toBe(8);
    expect(parseHoursPerDay("7.5")).toBe(7.5);
    expect(parseHoursPerDay(0)).toBeNull();
    expect(parseHoursPerDay(25)).toBeNull();
    expect(parseEveryHours(250)).toBe(250);
    expect(parseEveryHours(-1)).toBeNull();
  });
});

describe("operatingHoursToDayInterval", () => {
  it("rounds operating hours into calendar days", () => {
    expect(operatingHoursToDayInterval(8, 250)).toBe(31);
    expect(operatingHoursToDayInterval(8, 8)).toBe(1);
    expect(operatingHoursToDayInterval(24, 24)).toBe(1);
    expect(operatingHoursToDayInterval(8, 4)).toBe(1);
  });
});

describe("buildHourMaintenanceRecurrence", () => {
  it("stores a daily rule plus hourPlan metadata", () => {
    const rule = buildHourMaintenanceRecurrence({
      hoursPerDay: 8,
      everyHours: 250,
      anchorDate: "2026-08-18",
    });
    expect(rule.frequency).toBe("daily");
    expect(rule.interval).toBe(31);
    expect(rule.hourPlan).toEqual({ hoursPerDay: 8, everyHours: 250 });
  });
});

describe("hourMaintenanceSchedulePayload", () => {
  it("builds JSON recurrence and a next run on or after from", () => {
    const { recurrence, nextRunAt } = hourMaintenanceSchedulePayload({
      hoursPerDay: 8,
      everyHours: 8,
      anchorDate: "2026-08-01",
      from: new Date(2026, 7, 18),
    });
    const parsed = parseRecurrence(recurrence);
    expect(parsed?.hourPlan?.everyHours).toBe(8);
    expect(nextRunAt.getFullYear()).toBe(2026);
    expect(nextRunAt.getMonth()).toBe(7);
    expect(nextRunAt.getDate()).toBe(18);
  });
});

describe("preserveHourPlanInRecurrence", () => {
  it("copies hourPlan onto a rewritten calendar rule", () => {
    const previous = JSON.stringify({
      frequency: "daily",
      interval: 31,
      anchorDate: "2026-08-18",
      hourPlan: { hoursPerDay: 8, everyHours: 250 },
    });
    const next = JSON.stringify({
      frequency: "weekly",
      interval: 1,
      anchorDate: "2026-08-18",
      weekdays: [1],
    });
    const merged = parseRecurrence(preserveHourPlanInRecurrence(previous, next));
    expect(merged?.frequency).toBe("weekly");
    expect(merged?.hourPlan).toEqual({ hoursPerDay: 8, everyHours: 250 });
  });
});

describe("parseHourMaintenancePlanFields", () => {
  it("requires hours per day, interval hours, and a start date", () => {
    expect(
      parseHourMaintenancePlanFields({
        hoursPerDay: 8,
        everyHours: 250,
        startDate: "2026-08-18",
      }).ok
    ).toBe(true);
    expect(
      parseHourMaintenancePlanFields({ hoursPerDay: 8, everyHours: 250 }).ok
    ).toBe(false);
    expect(
      parseHourMaintenancePlanFields({
        hoursPerDay: 30,
        everyHours: 250,
        startDate: "2026-08-18",
      }).ok
    ).toBe(false);
  });
});

describe("formatHourMaintenancePreview", () => {
  it("shows operating hours and the rounded calendar interval", () => {
    expect(formatHourMaintenancePreview(8, 250)).toBe(
      "Cada 250 h de uso (8 h/día) · Cada 31 días en el calendario"
    );
    expect(formatHourMaintenancePreview(8, 8)).toBe(
      "Cada 8 h de uso (8 h/día) · Cada 1 día en el calendario"
    );
    expect(formatHourMaintenancePreview(0, 250)).toBeNull();
  });
});

describe("hourPlanTimingChanged", () => {
  it("detects hours or start date changes", () => {
    const base = {
      hoursPerDay: 8,
      everyHours: 250,
      startDate: "2026-08-18",
    };
    expect(hourPlanTimingChanged(base, base)).toBe(false);
    expect(
      hourPlanTimingChanged(base, { ...base, everyHours: 500 })
    ).toBe(true);
    expect(
      hourPlanTimingChanged(base, { ...base, startDate: "2026-09-01" })
    ).toBe(true);
  });
});

describe("hourMaintenancePlanView", () => {
  it("serializes nextRunAt and computes the day interval", () => {
    const view = hourMaintenancePlanView({
      id: "p1",
      name: "Lubricación",
      hoursPerDay: 8,
      everyHours: 250,
      startDate: "2026-08-18",
      calendarId: "cal_mantenimiento",
      calendarName: "Mantenimiento",
      checklistTemplateId: null,
      color: "#02257D",
      scheduleId: "s1",
      nextRunAt: new Date("2026-08-18T06:00:00.000Z"),
      recurrence: "{}",
      assigneeIds: ["u1"],
    });
    expect(view.dayInterval).toBe(31);
    expect(view.nextRunAt).toBe("2026-08-18T06:00:00.000Z");
    expect(view.assigneeIds).toEqual(["u1"]);
  });
});

describe("formatRecurrenceLabel hourPlan", () => {
  it("prefixes the calendar interval with operating hours", () => {
    const raw = JSON.stringify({
      frequency: "daily",
      interval: 31,
      anchorDate: "2026-08-18",
      hourPlan: { hoursPerDay: 8, everyHours: 250 },
    });
    expect(formatRecurrenceLabel(raw)).toBe(
      "Cada 250 h de uso (8 h/día) · Cada 31 días"
    );
  });
});
