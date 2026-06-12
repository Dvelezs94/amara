import { describe, expect, it } from "vitest";
import {
  analyticsFieldKey,
  buildAnalyticsFieldDescriptors,
  findChecklistItemByFieldKey,
  resolveSectionPath,
} from "@/lib/analytics-checklist-field-key";

describe("resolveSectionPath", () => {
  it("collects ancestor section labels", () => {
    const items = [
      { id: "horno", label: "Horno A", type: "section", parentItemId: null },
      { id: "t1", label: "Tarea 1", type: "section", parentItemId: "horno" },
      { id: "f1", label: "Boca (°C)", type: "custom_field", parentItemId: "t1" },
    ];
    expect(resolveSectionPath(items[2]!, items)).toEqual(["Horno A", "Tarea 1"]);
  });
});

describe("analyticsFieldKey", () => {
  it("includes section path for nested fields", () => {
    expect(analyticsFieldKey(["Horno A", "Tarea 1"], "Boca (°C)")).toBe(
      "Horno A / Tarea 1 › Boca (°C)"
    );
  });

  it("uses bare label for root fields", () => {
    expect(analyticsFieldKey([], "Campo libre")).toBe("Campo libre");
  });
});

describe("buildAnalyticsFieldDescriptors", () => {
  it("disambiguates duplicate labels in different sections", () => {
    const workOrders = [
      {
        checklistItems: [
          { id: "s1", label: "Sección 1", type: "section", parentItemId: null, sortOrder: 0 },
          { id: "f1", label: "Boca (°C)", type: "custom_field", parentItemId: "s1", sortOrder: 0 },
          { id: "s2", label: "Sección 2", type: "section", parentItemId: null, sortOrder: 1 },
          { id: "f2", label: "Boca (°C)", type: "custom_field", parentItemId: "s2", sortOrder: 0 },
        ],
      },
    ];
    const fields = buildAnalyticsFieldDescriptors(workOrders);
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.key)).toEqual([
      "Sección 1 › Boca (°C)",
      "Sección 2 › Boca (°C)",
    ]);
  });

  it("orders fields in checklist depth-first order", () => {
    const workOrders = [
      {
        checklistItems: [
          { id: "s1", label: "Zona A", type: "section", parentItemId: null, sortOrder: 0 },
          { id: "f1", label: "Primero", type: "custom_field", parentItemId: "s1", sortOrder: 0 },
          { id: "f2", label: "Segundo", type: "custom_field", parentItemId: "s1", sortOrder: 1 },
          { id: "f3", label: "Último", type: "custom_field", parentItemId: null, sortOrder: 1 },
        ],
      },
    ];
    const fields = buildAnalyticsFieldDescriptors(workOrders);
    expect(fields.map((f) => f.label)).toEqual(["Primero", "Segundo", "Último"]);
  });
});

describe("findChecklistItemByFieldKey", () => {
  const items = [
    { id: "s1", label: "Sección 1", type: "section", parentItemId: null },
    { id: "f1", label: "Boca (°C)", type: "custom_field", parentItemId: "s1", fieldType: "number" },
    { id: "s2", label: "Sección 2", type: "section", parentItemId: null },
    { id: "f2", label: "Boca (°C)", type: "custom_field", parentItemId: "s2", fieldType: "number" },
  ];

  it("matches by section-qualified key", () => {
    expect(findChecklistItemByFieldKey(items, "Sección 2 › Boca (°C)")?.id).toBe("f2");
  });

  it("falls back to legacy bare label when unique", () => {
    const unique = [
      { id: "f1", label: "Único", type: "custom_field", parentItemId: null, fieldType: "text" },
    ];
    expect(findChecklistItemByFieldKey(unique, "Único")?.id).toBe("f1");
  });

  it("does not match ambiguous legacy bare labels", () => {
    expect(findChecklistItemByFieldKey(items, "Boca (°C)")).toBeUndefined();
  });
});
