import { describe, expect, it } from "vitest";
import {
  formatWorkOrderElapsedCompact,
  formatWorkOrderElapsedLabel,
  workOrderShouldShowElapsed,
} from "@/lib/work-order-duration";

describe("workOrderShouldShowElapsed", () => {
  it("hides without startedAt", () => {
    expect(workOrderShouldShowElapsed("pending", null)).toBe(false);
    expect(workOrderShouldShowElapsed("in_progress", null)).toBe(false);
    expect(workOrderShouldShowElapsed("completed", undefined)).toBe(false);
  });
  it("shows when startedAt is set", () => {
    expect(workOrderShouldShowElapsed("pending", "2024-01-01T00:00:00.000Z")).toBe(
      true
    );
    expect(workOrderShouldShowElapsed("in_progress", "2024-01-01T00:00:00.000Z")).toBe(
      true
    );
    expect(workOrderShouldShowElapsed("completed", "2024-01-01T00:00:00.000Z")).toBe(
      true
    );
  });
});

describe("formatWorkOrderElapsedLabel", () => {
  const started = "2024-01-01T12:00:00.000Z";
  const completed = "2024-01-01T12:45:00.000Z";

  it("returns dash without startedAt", () => {
    expect(formatWorkOrderElapsedLabel(null, "completed", completed, Date.now())).toBe(
      "—"
    );
  });
  it("formats completed duration from startedAt to completedAt", () => {
    const s = formatWorkOrderElapsedLabel(started, "completed", completed, Date.now());
    expect(s).toBe("45 minutos");
  });
  it("does not use time before startedAt", () => {
    // created long before start — duration must still be 45 min from start
    const s = formatWorkOrderElapsedLabel(started, "completed", completed, Date.now());
    expect(s).not.toContain("hora");
    expect(s).toBe("45 minutos");
  });
});

describe("formatWorkOrderElapsedCompact", () => {
  it("returns compact for in_progress using startedAt → nowMs", () => {
    const started = new Date("2024-01-01T12:00:00.000Z");
    const now = started.getTime() + 90 * 60_000;
    const s = formatWorkOrderElapsedCompact(started, "in_progress", null, now);
    expect(s).toBe("1h 30m");
  });

  it("uses completedAt end for closed tasks", () => {
    const started = "2024-01-01T12:00:00.000Z";
    const completed = "2024-01-01T14:15:00.000Z";
    const later = new Date("2024-01-02T00:00:00.000Z").getTime();
    expect(formatWorkOrderElapsedCompact(started, "completed", completed, later)).toBe(
      "2h 15m"
    );
  });
});
