import { describe, expect, it } from "vitest";
import {
  formatUtcDateToDatetimeLocalValue,
  parseDatetimeLocalValue,
  validateWorkOrderCompletedAt,
} from "@/lib/datetime-local";

describe("datetime-local helpers", () => {
  it("formats and parses round-trip in America/Monterrey", () => {
    const iso = "2026-04-23T18:10:00.000Z";
    const local = formatUtcDateToDatetimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const back = parseDatetimeLocalValue(local);
    expect(back).not.toBeNull();
    expect(back!.toISOString()).toBe(iso);
  });

  it("rejects invalid local strings", () => {
    expect(parseDatetimeLocalValue("")).toBeNull();
    expect(parseDatetimeLocalValue("2026-13-01T12:00")).toBeNull();
    expect(parseDatetimeLocalValue("not-a-date")).toBeNull();
  });

  it("allows any valid completedAt for admin backdating", () => {
    expect(
      validateWorkOrderCompletedAt(new Date("2020-01-01T12:00:00Z"))
    ).toBeNull();
  });
});
