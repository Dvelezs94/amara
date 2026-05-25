import { describe, expect, it } from "vitest";
import {
  buildDefaultAnalyticsChartTitle,
  inferAnalyticsChartTitlePreset,
} from "@/lib/analytics-chart-title";

describe("analytics-chart-title", () => {
  it("infers presets from field type and label count", () => {
    expect(inferAnalyticsChartTitlePreset("number", 1)).toBe("number-time");
    expect(inferAnalyticsChartTitlePreset("dropdown", 2)).toBe("categorical-multi");
    expect(inferAnalyticsChartTitlePreset("checkbox", 1)).toBe("checkbox-single");
  });

  it("builds default titles", () => {
    expect(buildDefaultAnalyticsChartTitle(["boca"], "number-time")).toBe(
      "boca en el tiempo (punto por orden)"
    );
    expect(buildDefaultAnalyticsChartTitle(["a", "b"], "categorical-multi")).toBe(
      "a, b — comparación por categoría"
    );
  });
});
