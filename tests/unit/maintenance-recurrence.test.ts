import { describe, expect, it } from "vitest";
import {
  expandOccurrencesInRange,
  formatRecurrenceLabel,
  lastOccurrenceStrictlyBefore,
  parseRecurrence,
  parseYmdToLocalDate,
  ruleToMaintenanceEditFormState,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";

describe("parseRecurrence", () => {
  it("parses valid JSON rule", () => {
    const raw = JSON.stringify({
      frequency: "daily",
      interval: 1,
      anchorDate: "2024-06-15",
    });
    const r = parseRecurrence(raw);
    expect(r).not.toBeNull();
    expect(r?.frequency).toBe("daily");
    expect(r?.anchorDate).toBe("2024-06-15");
  });
  it("returns null for invalid JSON", () => {
    expect(parseRecurrence("not json")).toBeNull();
  });
});

describe("ruleToMaintenanceEditFormState", () => {
  it("maps quarterly monthly interval to UI frequency", () => {
    const r = parseRecurrence(
      JSON.stringify({
        frequency: "monthly",
        interval: 3,
        anchorDate: "2025-01-01",
      })
    )!;
    const u = ruleToMaintenanceEditFormState(r);
    expect(u.frequency).toBe("quarterly");
    expect(u.interval).toBe(1);
  });
});

describe("toYmdLocal / parseYmdToLocalDate", () => {
  it("round-trips local calendar day", () => {
    const d = new Date(2024, 5, 7);
    const ymd = toYmdLocal(d);
    expect(ymd).toBe("2024-06-07");
    const back = parseYmdToLocalDate(ymd);
    expect(back.getFullYear()).toBe(2024);
    expect(back.getMonth()).toBe(5);
    expect(back.getDate()).toBe(7);
  });
});

describe("formatRecurrenceLabel", () => {
  it("returns raw string when rule cannot be parsed", () => {
    expect(formatRecurrenceLabel("legacy plain text")).toBe("legacy plain text");
  });
  it("formats daily rule", () => {
    const raw = JSON.stringify({
      frequency: "daily",
      interval: 1,
      anchorDate: "2024-01-01",
    });
    expect(formatRecurrenceLabel(raw)).toContain("Cada día");
  });
});

describe("lastOccurrenceStrictlyBefore", () => {
  it("returns last weekly occurrence before split date", () => {
    const rule = parseRecurrence(
      JSON.stringify({
        frequency: "weekly",
        interval: 1,
        anchorDate: "2025-03-03",
        weekdays: [1],
      })
    );
    expect(rule).not.toBeNull();
    const last = lastOccurrenceStrictlyBefore(rule!, "2025-03-17");
    expect(last).not.toBeNull();
    expect(toYmdLocal(last!)).toBe("2025-03-10");
  });

  it("returns null when no occurrence exists before split", () => {
    const rule = parseRecurrence(
      JSON.stringify({
        frequency: "weekly",
        interval: 1,
        anchorDate: "2025-03-10",
        weekdays: [1],
      })
    );
    expect(rule).not.toBeNull();
    expect(lastOccurrenceStrictlyBefore(rule!, "2025-03-10")).toBeNull();
  });
});

describe("expandOccurrencesInRange", () => {
  it("expands daily rule within range", () => {
    const rule = parseRecurrence(
      JSON.stringify({
        frequency: "daily",
        interval: 1,
        anchorDate: "2024-01-10",
      })
    );
    expect(rule).not.toBeNull();
    const start = new Date(2024, 0, 10);
    const end = new Date(2024, 0, 12);
    const dates = expandOccurrencesInRange(rule!, start, end);
    expect(dates.length).toBeGreaterThanOrEqual(3);
    expect(toYmdLocal(dates[0]!)).toBe("2024-01-10");
  });
});
