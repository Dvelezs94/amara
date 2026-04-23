import { describe, expect, it } from "vitest";
import {
  expandOccurrencesInRange,
  formatRecurrenceLabel,
  parseRecurrence,
  parseYmdToLocalDate,
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
