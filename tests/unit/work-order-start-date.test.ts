import { describe, expect, it } from "vitest";
import {
  isWorkOrderVisibleOnMobile,
  parseOptionalWorkOrderDateInput,
  ymdInTimeZone,
} from "@/lib/work-order-start-date";

describe("parseOptionalWorkOrderDateInput", () => {
  it("treats empty as null", () => {
    expect(parseOptionalWorkOrderDateInput(undefined)).toEqual({ ok: true, date: null });
    expect(parseOptionalWorkOrderDateInput(null)).toEqual({ ok: true, date: null });
    expect(parseOptionalWorkOrderDateInput("")).toEqual({ ok: true, date: null });
  });

  it("parses YYYY-MM-DD", () => {
    const r = parseOptionalWorkOrderDateInput("2026-07-30");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.date).toBeInstanceOf(Date);
      expect(r.date!.getFullYear()).toBe(2026);
      expect(r.date!.getMonth()).toBe(6);
      expect(r.date!.getDate()).toBe(30);
    }
  });

  it("rejects invalid", () => {
    expect(parseOptionalWorkOrderDateInput("not-a-date").ok).toBe(false);
    expect(parseOptionalWorkOrderDateInput(42).ok).toBe(false);
  });
});

describe("isWorkOrderVisibleOnMobile", () => {
  const now = new Date("2026-07-29T18:00:00.000Z"); // afternoon UTC → still Jul 29 in Monterrey

  it("shows when startDate and dueDate are missing", () => {
    expect(isWorkOrderVisibleOnMobile(null)).toBe(true);
    expect(isWorkOrderVisibleOnMobile(undefined)).toBe(true);
    expect(isWorkOrderVisibleOnMobile({})).toBe(true);
  });

  it("hides before start day and shows on/after (Monterrey calendar)", () => {
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-30" }, now)).toBe(false);
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-29" }, now)).toBe(true);
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-28" }, now)).toBe(true);
  });

  it("hides future dueDate when startDate is missing", () => {
    expect(isWorkOrderVisibleOnMobile({ dueDate: "2026-07-30" }, now)).toBe(false);
    expect(isWorkOrderVisibleOnMobile({ dueDate: "2026-07-29" }, now)).toBe(true);
  });

  it("prefers startDate over a later dueDate", () => {
    expect(
      isWorkOrderVisibleOnMobile(
        { startDate: "2026-07-29", dueDate: "2026-08-05" },
        now
      )
    ).toBe(true);
  });
});

describe("ymdInTimeZone", () => {
  it("formats en-CA style", () => {
    expect(ymdInTimeZone(new Date("2026-01-15T12:00:00.000Z"), "UTC")).toBe("2026-01-15");
  });
});
