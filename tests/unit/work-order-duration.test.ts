import { describe, expect, it } from "vitest";
import {
  formatWorkOrderElapsedCompact,
  formatWorkOrderElapsedLabel,
  workOrderShouldShowElapsed,
} from "@/lib/work-order-duration";

describe("workOrderShouldShowElapsed", () => {
  it("hides for pending without startedAt", () => {
    expect(workOrderShouldShowElapsed("pending", null)).toBe(false);
    expect(workOrderShouldShowElapsed("pending", undefined)).toBe(false);
  });
  it("shows for pending with startedAt", () => {
    expect(workOrderShouldShowElapsed("pending", "2024-01-01T00:00:00.000Z")).toBe(
      true
    );
  });
  it("shows for in_progress and completed", () => {
    expect(workOrderShouldShowElapsed("in_progress", null)).toBe(true);
    expect(workOrderShouldShowElapsed("completed", null)).toBe(true);
  });
});

describe("formatWorkOrderElapsedLabel", () => {
  const created = "2024-01-01T12:00:00.000Z";
  const completed = "2024-01-01T12:45:00.000Z";

  it("returns dash for invalid createdAt", () => {
    expect(formatWorkOrderElapsedLabel("bad", "completed", completed, Date.now())).toBe(
      "—"
    );
  });
  it("formats completed duration in minutes", () => {
    const s = formatWorkOrderElapsedLabel(created, "completed", completed, Date.now());
    expect(s).toContain("minuto");
  });
});

describe("formatWorkOrderElapsedCompact", () => {
  it("returns compact for in_progress using nowMs", () => {
    const created = new Date("2024-01-01T12:00:00.000Z");
    const now = created.getTime() + 90 * 60_000;
    const s = formatWorkOrderElapsedCompact(
      created,
      "in_progress",
      null,
      now
    );
    expect(s).toMatch(/\d/);
  });
});
