import { describe, expect, it } from "vitest";
import { parseRecurrencePayloadFromMaintenanceBody } from "@/lib/maintenance-schedule-recurrence-from-request";

describe("parseRecurrencePayloadFromMaintenanceBody", () => {
  it("accepts weekly with weekdays", () => {
    const r = parseRecurrencePayloadFromMaintenanceBody({
      startDate: "2025-01-06",
      frequency: "weekly",
      interval: 1,
      weekdays: [1, 3],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rule.frequency).toBe("weekly");
      expect(r.rule.weekdays).toEqual([1, 3]);
    }
  });

  it("rejects invalid startDate", () => {
    const r = parseRecurrencePayloadFromMaintenanceBody({
      startDate: "bad",
      frequency: "daily",
      interval: 1,
    });
    expect(r.ok).toBe(false);
  });
});
