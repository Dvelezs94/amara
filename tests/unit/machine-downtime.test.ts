import { describe, expect, it } from "vitest";
import {
  clampManualDowntimeMinutes,
  effectiveCountsMachineDowntime,
  formatDowntimeMinutesSpanish,
  workOrderAutomaticDowntimeMinutes,
  workOrderInProgressDowntimeMinutesSoFar,
  workOrderTotalDowntimeMinutesForAsset,
} from "@/lib/machine-downtime";

describe("effectiveCountsMachineDowntime", () => {
  it("requires WO flag true and asset not opted out", () => {
    expect(effectiveCountsMachineDowntime(true, true)).toBe(true);
    expect(effectiveCountsMachineDowntime(true, undefined)).toBe(true);
    expect(effectiveCountsMachineDowntime(true, null)).toBe(true);
    expect(effectiveCountsMachineDowntime(false, true)).toBe(false);
    expect(effectiveCountsMachineDowntime(undefined, true)).toBe(false);
    expect(effectiveCountsMachineDowntime(true, false)).toBe(false);
  });
});

describe("clampManualDowntimeMinutes", () => {
  it("accepts valid integers", () => {
    expect(clampManualDowntimeMinutes(0)).toBe(0);
    expect(clampManualDowntimeMinutes(90)).toBe(90);
  });
  it("rejects non-integers and out of range", () => {
    expect(clampManualDowntimeMinutes(1.5)).toBeNull();
    expect(clampManualDowntimeMinutes(-1)).toBeNull();
    expect(clampManualDowntimeMinutes(600_000)).toBeNull();
    expect(clampManualDowntimeMinutes("x")).toBeNull();
  });
});

describe("workOrderAutomaticDowntimeMinutes", () => {
  it("returns 0 when flag off or not completed", () => {
    expect(
      workOrderAutomaticDowntimeMinutes({
        status: "in_progress",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: null,
      })
    ).toBe(0);
    expect(
      workOrderAutomaticDowntimeMinutes({
        status: "completed",
        countsMachineDowntime: false,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T11:30:00Z",
      })
    ).toBe(0);
  });
  it("computes floor minutes from startedAt to completedAt when completed and flag on", () => {
    expect(
      workOrderAutomaticDowntimeMinutes({
        status: "completed",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T10:45:00Z",
      })
    ).toBe(45);
  });
});

describe("workOrderInProgressDowntimeMinutesSoFar", () => {
  it("returns 0 when not in progress", () => {
    expect(
      workOrderInProgressDowntimeMinutesSoFar({
        status: "pending",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        nowMs: Date.parse("2024-01-01T12:00:00Z"),
      })
    ).toBe(0);
  });
  it("uses nowMs from startedAt", () => {
    expect(
      workOrderInProgressDowntimeMinutesSoFar({
        status: "in_progress",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        nowMs: Date.parse("2024-01-01T10:30:00Z"),
      })
    ).toBe(30);
  });
});

describe("workOrderTotalDowntimeMinutesForAsset", () => {
  it("only counts when completed and asset set", () => {
    expect(
      workOrderTotalDowntimeMinutesForAsset({
        status: "in_progress",
        assetId: "a1",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: null,
        manualDowntimeMinutes: 10,
      })
    ).toBe(0);
    expect(
      workOrderTotalDowntimeMinutesForAsset({
        status: "completed",
        assetId: null,
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T11:00:00Z",
        manualDowntimeMinutes: 10,
      })
    ).toBe(0);
  });
  it("sums automatic and manual", () => {
    expect(
      workOrderTotalDowntimeMinutesForAsset({
        status: "completed",
        assetId: "a1",
        countsMachineDowntime: true,
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T11:00:00Z",
        manualDowntimeMinutes: 15,
      })
    ).toBe(75);
  });
});

describe("formatDowntimeMinutesSpanish", () => {
  it("formats", () => {
    expect(formatDowntimeMinutesSpanish(0)).toBe("0 min");
    expect(formatDowntimeMinutesSpanish(45)).toBe("45 min");
    expect(formatDowntimeMinutesSpanish(120)).toBe("2 h");
    expect(formatDowntimeMinutesSpanish(90)).toBe("1 h 30 min");
  });
});
