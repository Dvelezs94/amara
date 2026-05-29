import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  parseWorkOrderStatusColors,
  resolveWorkOrderStatusColor,
  workOrderStatusBadgeStyle,
  workOrderStatusMarkerColor,
} from "@/lib/work-order-status-colors";

describe("work-order-status-colors", () => {
  it("uses defaults when custom colors missing", () => {
    expect(workOrderStatusMarkerColor("pending")).toBe(
      DEFAULT_WORK_ORDER_STATUS_COLORS.pending
    );
    expect(resolveWorkOrderStatusColor("completed", { pending: "#111111" })).toBe(
      DEFAULT_WORK_ORDER_STATUS_COLORS.completed
    );
  });

  it("parses and applies custom hex colors", () => {
    const custom = parseWorkOrderStatusColors({
      pending: "#112233",
      in_progress: "#445566",
      completed: "#778899",
      cancelled: "#aabbcc",
    });
    expect(custom?.pending).toBe("#112233");
    expect(workOrderStatusMarkerColor("pending", custom)).toBe("#112233");
    expect(workOrderStatusBadgeStyle("pending", custom).backgroundColor).toContain(
      "#112233"
    );
  });

  it("rejects invalid payloads", () => {
    expect(parseWorkOrderStatusColors(null)).toBeNull();
    expect(parseWorkOrderStatusColors({ pending: "not-a-color" })).toBeNull();
  });
});
