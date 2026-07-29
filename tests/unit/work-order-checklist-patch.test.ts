import { describe, expect, it } from "vitest";
import {
  normalizeChecklistPatchValue,
  parseWorkOrderChecklistPatchBody,
} from "@/lib/work-order-checklist-patch";

describe("normalizeChecklistPatchValue", () => {
  it("normalizes number from string or number", () => {
    expect(normalizeChecklistPatchValue("number", 12)).toBe(12);
    expect(normalizeChecklistPatchValue("number", "12,5")).toBe(12.5);
    expect(normalizeChecklistPatchValue("number", "")).toBeNull();
    expect(normalizeChecklistPatchValue("number", "x")).toBeNull();
  });

  it("normalizes checkbox", () => {
    expect(normalizeChecklistPatchValue("checkbox", true)).toBe(true);
    expect(normalizeChecklistPatchValue("checkbox", false)).toBe(false);
    expect(normalizeChecklistPatchValue("checkbox", null)).toBeNull();
    expect(normalizeChecklistPatchValue("checkbox", "yes")).toBeNull();
  });

  it("normalizes photo to URL array", () => {
    expect(normalizeChecklistPatchValue("photo", "/a")).toEqual(["/a"]);
    expect(normalizeChecklistPatchValue("photo", ["/a", "", "/b"])).toEqual(["/a", "/b"]);
    expect(normalizeChecklistPatchValue("photo", null)).toEqual([]);
  });

  it("normalizes text/date/dropdown", () => {
    expect(normalizeChecklistPatchValue("text", "hola")).toBe("hola");
    expect(normalizeChecklistPatchValue("text", "  ")).toBeNull();
    expect(normalizeChecklistPatchValue("date", "2026-01-02")).toBe("2026-01-02");
    expect(normalizeChecklistPatchValue("dropdown", "Opt")).toBe("Opt");
  });
});

describe("parseWorkOrderChecklistPatchBody", () => {
  it("requires itemId and at least one update", () => {
    expect(parseWorkOrderChecklistPatchBody({}).ok).toBe(false);
    expect(parseWorkOrderChecklistPatchBody({ itemId: "i1" }).ok).toBe(false);
  });

  it("accepts value: null (clear field)", () => {
    const r = parseWorkOrderChecklistPatchBody({ itemId: "i1", value: null });
    expect(r).toEqual({
      ok: true,
      itemId: "i1",
      updates: { value: null },
    });
  });

  it("accepts completed for steps", () => {
    const r = parseWorkOrderChecklistPatchBody({ itemId: "s1", completed: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.updates.completed).toBe(true);
  });

  it("rejects non-boolean completed", () => {
    const r = parseWorkOrderChecklistPatchBody({ itemId: "s1", completed: "yes" });
    expect(r.ok).toBe(false);
  });

  it("normalizes value using row fieldType", () => {
    const r = parseWorkOrderChecklistPatchBody(
      { itemId: "n1", value: "3,14" },
      { type: "custom_field", fieldType: "number" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.updates.value).toBe(3.14);
  });

  it("covers all custom field types end-to-end in patch parse", () => {
    const cases: Array<{
      fieldType: string;
      value: unknown;
      expected: unknown;
    }> = [
      { fieldType: "text", value: "nota", expected: "nota" },
      { fieldType: "number", value: 7, expected: 7 },
      { fieldType: "date", value: "2026-07-30", expected: "2026-07-30" },
      { fieldType: "dropdown", value: "Alta", expected: "Alta" },
      { fieldType: "checkbox", value: false, expected: false },
      { fieldType: "photo", value: ["/p1", "/p2"], expected: ["/p1", "/p2"] },
    ];
    for (const c of cases) {
      const r = parseWorkOrderChecklistPatchBody(
        { itemId: "x", value: c.value },
        { type: "custom_field", fieldType: c.fieldType }
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.updates.value).toEqual(c.expected);
    }
  });
});
