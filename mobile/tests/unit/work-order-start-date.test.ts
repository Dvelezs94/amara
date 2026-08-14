import { describe, expect, it } from "vitest";
import { isWorkOrderVisibleOnMobile } from "../../lib/work-order-start-date";

describe("isWorkOrderVisibleOnMobile", () => {
  const now = new Date("2026-07-29T18:00:00.000Z"); // afternoon UTC → still Jul 29 in Monterrey

  it("shows without startDate or dueDate", () => {
    expect(isWorkOrderVisibleOnMobile(null)).toBe(true);
    expect(isWorkOrderVisibleOnMobile({})).toBe(true);
    expect(isWorkOrderVisibleOnMobile({ startDate: null, dueDate: null })).toBe(true);
  });

  it("gates by startDate calendar day", () => {
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-30" }, now)).toBe(false);
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-29" }, now)).toBe(true);
    expect(isWorkOrderVisibleOnMobile({ startDate: "2026-07-28" }, now)).toBe(true);
  });

  it("hides future dueDate when startDate is missing", () => {
    expect(isWorkOrderVisibleOnMobile({ dueDate: "2026-07-30" }, now)).toBe(false);
    expect(isWorkOrderVisibleOnMobile({ dueDate: "2026-07-29" }, now)).toBe(true);
    expect(isWorkOrderVisibleOnMobile({ dueDate: "2026-07-28" }, now)).toBe(true);
  });

  it("prefers startDate over a later dueDate", () => {
    expect(
      isWorkOrderVisibleOnMobile(
        { startDate: "2026-07-29", dueDate: "2026-08-05" },
        now
      )
    ).toBe(true);
    expect(
      isWorkOrderVisibleOnMobile(
        { startDate: "2026-07-30", dueDate: "2026-07-29" },
        now
      )
    ).toBe(false);
  });
});
