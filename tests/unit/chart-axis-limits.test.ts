import { describe, expect, it } from "vitest";
import {
  computeAutoYDomain,
  parseChartAxisLimits,
  resolveXAxisDomain,
  resolveYAxisDomain,
} from "@/lib/chart-axis-limits";

describe("parseChartAxisLimits", () => {
  it("defaults to auto axes", () => {
    expect(parseChartAxisLimits(null)).toEqual({
      yAuto: true,
      yMin: null,
      yMax: null,
      xAuto: true,
      xMin: null,
      xMax: null,
    });
  });
});

describe("resolveYAxisDomain", () => {
  it("uses manual limits when yAuto is false", () => {
    expect(
      resolveYAxisDomain(
        { yAuto: false, yMin: 100, yMax: 300, xAuto: true, xMin: null, xMax: null },
        [50, 400]
      )
    ).toEqual([100, 300]);
  });

  it("keeps auto domain when yAuto is true", () => {
    expect(
      resolveYAxisDomain(
        { yAuto: true, yMin: 100, yMax: 300, xAuto: true, xMin: null, xMax: null },
        [50, 400]
      )
    ).toEqual([50, 400]);
  });
});

describe("resolveXAxisDomain", () => {
  it("uses manual timestamp limits when xAuto is false", () => {
    expect(
      resolveXAxisDomain(
        { yAuto: true, yMin: null, yMax: null, xAuto: false, xMin: 1000, xMax: 2000 },
        [0, 5000]
      )
    ).toEqual([1000, 2000]);
  });
});

describe("computeAutoYDomain", () => {
  it("pads numeric values", () => {
    const domain = computeAutoYDomain([{ a: 10 }, { a: 20 }], ["a"]);
    expect(domain[0]).toBeLessThan(10);
    expect(domain[1]).toBeGreaterThan(20);
  });
});
