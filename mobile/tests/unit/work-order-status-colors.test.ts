import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  mergeWorkOrderStatusColors,
  mixHexColors,
  parseWorkOrderStatusColors,
  resolveWorkOrderStatusColor,
  workOrderStatusBadgeStyleRn,
} from "../../lib/work-order-status-colors";

describe("parseWorkOrderStatusColors", () => {
  it("parses custom hex and expands short form", () => {
    const custom = parseWorkOrderStatusColors({
      pending: "#112233",
      in_progress: "#abc",
    });
    expect(custom?.pending).toBe("#112233");
    expect(custom?.in_progress).toBe("#aabbcc");
    expect(custom?.completed).toBe(DEFAULT_WORK_ORDER_STATUS_COLORS.completed);
  });

  it("rejects invalid payloads", () => {
    expect(parseWorkOrderStatusColors(null)).toBeNull();
    expect(parseWorkOrderStatusColors({ pending: "red" })).toBeNull();
  });
});

describe("mergeWorkOrderStatusColors", () => {
  it("falls back to defaults", () => {
    expect(mergeWorkOrderStatusColors(null)).toEqual(DEFAULT_WORK_ORDER_STATUS_COLORS);
  });
});

describe("resolveWorkOrderStatusColor", () => {
  it("uses custom then defaults", () => {
    expect(resolveWorkOrderStatusColor("pending", { pending: "#111111" })).toBe("#111111");
    expect(resolveWorkOrderStatusColor("completed", { pending: "#111111" })).toBe(
      DEFAULT_WORK_ORDER_STATUS_COLORS.completed
    );
  });
});

describe("mixHexColors", () => {
  it("returns endpoints at 0 and 1", () => {
    expect(mixHexColors("#ff0000", "#0000ff", 1)).toBe("#ff0000");
    expect(mixHexColors("#ff0000", "#0000ff", 0)).toBe("#0000ff");
  });
});

describe("workOrderStatusBadgeStyleRn", () => {
  it("uses status color for border and mixes for fill/text", () => {
    const style = workOrderStatusBadgeStyleRn("pending", { pending: "#112233" });
    expect(style.borderColor).toBe("#112233");
    expect(style.backgroundColor).not.toBe("#112233");
    expect(style.color).not.toBe("#112233");
  });
});
