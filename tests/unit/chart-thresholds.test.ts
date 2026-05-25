import { describe, expect, it } from "vitest";
import {
  computeNumericChartDomain,
  DEFAULT_THRESHOLD_COLOR,
  highestExceededThreshold,
  normalizeThresholdColor,
  parseChartThresholds,
  resolveThresholdColor,
  valueExceedsAnyThreshold,
} from "@/lib/chart-thresholds";

describe("chart-thresholds", () => {
  it("parseChartThresholds filters invalid entries", () => {
    const parsed = parseChartThresholds([
      { id: "a", value: 42, label: "Máx" },
      { value: "bad" },
      { id: "b", value: 10 },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: "a", value: 42, label: "Máx" });
    expect(parsed[1]?.value).toBe(10);
  });

  it("computeNumericChartDomain includes threshold values", () => {
    const domain = computeNumericChartDomain(
      [{ date: "1", s0: 5 }, { date: "2", s0: 15 }],
      ["s0"],
      [{ id: "t1", value: 20 }]
    );
    expect(domain).not.toEqual(["auto", "auto"]);
    if (domain[0] !== "auto") {
      expect(domain[1]).toBeGreaterThan(20);
      expect(domain[0]).toBeLessThan(5);
    }
  });

  it("valueExceedsAnyThreshold when above any line", () => {
    const thresholds = [{ id: "t", value: 30 }];
    expect(valueExceedsAnyThreshold(31, thresholds)).toBe(true);
    expect(valueExceedsAnyThreshold(30, thresholds)).toBe(false);
    expect(valueExceedsAnyThreshold(29, thresholds)).toBe(false);
  });

  it("parseChartThresholds keeps valid colors", () => {
    const parsed = parseChartThresholds([{ id: "a", value: 1, color: "#abc" }]);
    expect(parsed[0]?.color).toBe("#aabbcc");
  });

  it("resolveThresholdColor defaults to red", () => {
    expect(resolveThresholdColor({})).toBe(DEFAULT_THRESHOLD_COLOR);
    expect(resolveThresholdColor({ color: "#0891b2" })).toBe("#0891b2");
  });

  it("highestExceededThreshold picks highest line crossed", () => {
    const thresholds = [
      { id: "a", value: 10, color: "#dc2626" },
      { id: "b", value: 20, color: "#0891b2" },
    ];
    expect(highestExceededThreshold(25, thresholds)?.id).toBe("b");
    expect(highestExceededThreshold(15, thresholds)?.id).toBe("a");
    expect(highestExceededThreshold(5, thresholds)).toBeNull();
  });

  it("normalizeThresholdColor rejects invalid values", () => {
    expect(normalizeThresholdColor("red")).toBeUndefined();
    expect(normalizeThresholdColor("#fff")).toBe("#ffffff");
  });
});
