import { describe, expect, it } from "vitest";
import { isWorkOrderVisibleOnMobile } from "../../lib/work-order-start-date";

describe("isWorkOrderVisibleOnMobile", () => {
  it("shows without startDate", () => {
    expect(isWorkOrderVisibleOnMobile(null)).toBe(true);
  });

  it("gates by calendar day", () => {
    const now = new Date("2026-07-29T18:00:00.000Z");
    expect(isWorkOrderVisibleOnMobile("2026-07-30", now)).toBe(false);
    expect(isWorkOrderVisibleOnMobile("2026-07-29", now)).toBe(true);
  });
});
