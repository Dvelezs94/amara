import { describe, expect, it } from "vitest";
import {
  DASHBOARD_QUICK_PRESETS,
  matchQuickPreset,
  maxSpanRangeEndingToday,
  rangeForQuickPreset,
} from "@/lib/dashboard-quick-presets";

/** Fixed Wednesday 2026-07-15 local noon-ish via local Date ctor. */
const NOW = new Date(2026, 6, 15, 12, 0, 0);

describe("rangeForQuickPreset", () => {
  it("returns today as single day", () => {
    expect(rangeForQuickPreset("today", NOW)).toEqual({
      from: "2026-07-15",
      to: "2026-07-15",
    });
  });

  it("returns yesterday", () => {
    expect(rangeForQuickPreset("yesterday", NOW)).toEqual({
      from: "2026-07-14",
      to: "2026-07-14",
    });
  });

  it("returns this week Mon–today", () => {
    // 2026-07-15 is Wednesday → Monday is 2026-07-13
    expect(rangeForQuickPreset("this_week", NOW)).toEqual({
      from: "2026-07-13",
      to: "2026-07-15",
    });
  });

  it("returns last week Mon–Sun", () => {
    expect(rangeForQuickPreset("last_week", NOW)).toEqual({
      from: "2026-07-06",
      to: "2026-07-12",
    });
  });

  it("returns this month", () => {
    expect(rangeForQuickPreset("this_month", NOW)).toEqual({
      from: "2026-07-01",
      to: "2026-07-15",
    });
  });

  it("returns last year full year", () => {
    expect(rangeForQuickPreset("last_year", NOW)).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("max_span ends today within max window", () => {
    expect(maxSpanRangeEndingToday(NOW)).toEqual({
      from: "2024-07-15",
      to: "2026-07-15",
    });
  });
});

describe("matchQuickPreset", () => {
  it("matches each preset id to itself", () => {
    for (const { id } of DASHBOARD_QUICK_PRESETS) {
      expect(matchQuickPreset(rangeForQuickPreset(id, NOW), NOW)).toBe(id);
    }
  });

  it("returns custom for arbitrary range", () => {
    expect(matchQuickPreset({ from: "2020-01-01", to: "2020-01-02" }, NOW)).toBe(
      "custom"
    );
  });
});
