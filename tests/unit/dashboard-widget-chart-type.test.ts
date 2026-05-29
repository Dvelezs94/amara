import { describe, expect, it } from "vitest";
import {
  clampWidgetChartType,
  parseChartTypeFromRequest,
} from "@/lib/dashboard-widget-chart-type";

describe("parseChartTypeFromRequest", () => {
  it("accepts allowed values", () => {
    expect(parseChartTypeFromRequest("bar")).toBe("bar");
    expect(parseChartTypeFromRequest("pie")).toBe("pie");
    expect(parseChartTypeFromRequest("stacked")).toBe("stacked");
  });
  it("defaults invalid to line", () => {
    expect(parseChartTypeFromRequest(null)).toBe("line");
    expect(parseChartTypeFromRequest("area")).toBe("line");
  });
});

describe("clampWidgetChartType", () => {
  it("number: keeps line or bar", () => {
    expect(clampWidgetChartType("bar", "number", 2)).toBe("bar");
    expect(clampWidgetChartType("line", "number", 1)).toBe("line");
  });
  it("number: rejects pie", () => {
    expect(clampWidgetChartType("pie", "number", 1)).toBe("line");
  });
  it("checkbox multi: forces bar", () => {
    expect(clampWidgetChartType("pie", "checkbox", 2)).toBe("bar");
  });
  it("checkbox single: bar or pie", () => {
    expect(clampWidgetChartType("pie", "checkbox", 1)).toBe("pie");
    expect(clampWidgetChartType("line", "checkbox", 1)).toBe("pie");
  });
  it("categorical multi: forces bar", () => {
    expect(clampWidgetChartType("pie", "dropdown", 3)).toBe("bar");
  });
  it("categorical single: defaults to stacked daily", () => {
    expect(clampWidgetChartType(null, "dropdown", 1)).toBe("stacked");
    expect(clampWidgetChartType("pie", "dropdown", 1)).toBe("pie");
    expect(clampWidgetChartType("stacked", "dropdown", 1)).toBe("stacked");
  });
});
