import { describe, expect, it } from "vitest";
import {
  checklistAnalyticsDateBounds,
  endOfLocalDayFromYmd,
  startOfLocalDayFromYmd,
} from "@/lib/dashboard-date-range";

describe("checklistAnalyticsDateBounds", () => {
  it("uses inclusive end of local day for to", () => {
    const { rangeStart, rangeEnd } = checklistAnalyticsDateBounds("2026-05-10", "2026-05-15");
    expect(rangeStart).toEqual(startOfLocalDayFromYmd("2026-05-10"));
    expect(rangeEnd).toEqual(endOfLocalDayFromYmd("2026-05-15"));
  });

  it("single day: end is after start", () => {
    const { rangeStart, rangeEnd } = checklistAnalyticsDateBounds("2026-05-15", "2026-05-15");
    expect(rangeEnd!.getTime()).toBeGreaterThan(rangeStart!.getTime());
    const noon = new Date(2026, 4, 15, 12, 0, 0, 0).getTime();
    expect(noon).toBeGreaterThanOrEqual(rangeStart!.getTime());
    expect(noon).toBeLessThanOrEqual(rangeEnd!.getTime());
  });

  it("swaps reversed range", () => {
    const { rangeStart, rangeEnd } = checklistAnalyticsDateBounds("2026-05-20", "2026-05-10");
    expect(rangeStart).toEqual(startOfLocalDayFromYmd("2026-05-10"));
    expect(rangeEnd).toEqual(endOfLocalDayFromYmd("2026-05-20"));
  });

  it("ignores invalid ymd", () => {
    expect(checklistAnalyticsDateBounds("not-a-date", "2026-05-15")).toEqual({
      rangeStart: null,
      rangeEnd: endOfLocalDayFromYmd("2026-05-15"),
    });
  });
});
