import { describe, expect, it } from "vitest";
import {
  buildMultiCategoricalUnion,
  buildMultiCheckboxBars,
  buildMultiNumberTimeData,
  commonFieldType,
  normalizeWidgetFieldLabels,
} from "@/lib/analytics-checklist-multi-chart";

const wo = (
  completedAt: string,
  items: { label: string; fieldType: string; value: unknown }[]
) => ({
  completedAt,
  checklistItems: items.map((x) => ({
    label: x.label,
    type: "custom_field" as const,
    fieldType: x.fieldType,
    value: x.value,
  })),
});

describe("normalizeWidgetFieldLabels", () => {
  it("prefers fieldLabels when set", () => {
    expect(normalizeWidgetFieldLabels("A", ["B", "C"])).toEqual(["B", "C"]);
  });
  it("falls back to fieldLabel", () => {
    expect(normalizeWidgetFieldLabels("X", null)).toEqual(["X"]);
  });
});

describe("commonFieldType", () => {
  it("detects shared number type", () => {
    const rows = [
      wo("2024-01-01T12:00:00Z", [
        { label: "A", fieldType: "number", value: 1 },
        { label: "B", fieldType: "number", value: 2 },
      ]),
    ];
    expect(commonFieldType(rows, ["A", "B"])).toBe("number");
  });
  it("returns null when types differ", () => {
    const rows = [
      wo("2024-01-01T12:00:00Z", [
        { label: "A", fieldType: "number", value: 1 },
        { label: "B", fieldType: "text", value: "x" },
      ]),
    ];
    expect(commonFieldType(rows, ["A", "B"])).toBeNull();
  });
});

describe("buildMultiNumberTimeData", () => {
  it("builds one row per work order with multiple series keys", () => {
    const rows = [
      wo("2024-01-02T12:00:00Z", [
        { label: "A", fieldType: "number", value: 10 },
        { label: "B", fieldType: "number", value: 20 },
      ]),
      wo("2024-01-01T12:00:00Z", [
        { label: "A", fieldType: "number", value: 1 },
        { label: "B", fieldType: "number", value: 2 },
      ]),
    ];
    const { data, series } = buildMultiNumberTimeData(rows, ["A", "B"], "UTC");
    expect(series.map((s) => s.key)).toEqual(["s0", "s1"]);
    expect(data).toHaveLength(2);
    expect(data[0]!.s0).toBe(1);
    expect(data[0]!.s1).toBe(2);
    expect(data[1]!.s0).toBe(10);
  });
});

describe("buildMultiCheckboxBars", () => {
  it("counts per field", () => {
    const rows = [
      wo("2024-01-01T12:00:00Z", [
        { label: "A", fieldType: "checkbox", value: true },
        { label: "B", fieldType: "checkbox", value: false },
      ]),
      wo("2024-01-02T12:00:00Z", [
        { label: "A", fieldType: "checkbox", value: false },
        { label: "B", fieldType: "checkbox", value: true },
      ]),
    ];
    const out = buildMultiCheckboxBars(rows, ["A", "B"]);
    expect(out.find((x) => x.name === "A")).toEqual({ name: "A", sí: 1, no: 1 });
    expect(out.find((x) => x.name === "B")).toEqual({ name: "B", sí: 1, no: 1 });
  });
});

describe("buildMultiCategoricalUnion", () => {
  it("unions values", () => {
    const rows = [
      wo("2024-01-01T12:00:00Z", [
        { label: "Color", fieldType: "dropdown", value: "Rojo" },
        { label: "Talla", fieldType: "dropdown", value: "M" },
      ]),
      wo("2024-01-02T12:00:00Z", [
        { label: "Color", fieldType: "dropdown", value: "Rojo" },
        { label: "Talla", fieldType: "dropdown", value: "L" },
      ]),
    ];
    const { data, series } = buildMultiCategoricalUnion(rows, ["Color", "Talla"]);
    expect(series.map((s) => s.name)).toEqual(["Color", "Talla"]);
    const rojo = data.find((d) => d.name === "Rojo");
    expect(rojo?.c0).toBe(2);
    expect(rojo?.c1).toBe(0);
  });
});
