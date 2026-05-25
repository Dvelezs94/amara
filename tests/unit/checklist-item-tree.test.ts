import { describe, expect, it } from "vitest";
import {
  flattenChecklistTreeForDisplay,
  groupFlattenedChecklistBySection,
  sortChecklistChildren,
} from "@/lib/checklist-item-tree";

describe("checklist-item-tree", () => {
  it("sortChecklistChildren orders by sortOrder with missing treated as 0", () => {
    const rows = [
      { id: "b", parentItemId: null, sortOrder: 2 },
      { id: "a", parentItemId: null },
    ];
    const sorted = sortChecklistChildren(rows, null);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("flattenChecklistTreeForDisplay walks depth-first under parents", () => {
    const rows = [
      { id: "s1", parentItemId: null, sortOrder: 0, type: "section" },
      { id: "s2", parentItemId: null, sortOrder: 1, type: "section" },
      { id: "c1", parentItemId: "s1", sortOrder: 0, type: "step" },
      { id: "c2", parentItemId: "s1", sortOrder: 1, type: "step" },
    ];
    const flat = flattenChecklistTreeForDisplay(rows);
    expect(flat.map((r) => r.id)).toEqual(["s1", "c1", "c2", "s2"]);
  });

  it("groupFlattenedChecklistBySection bundles each section with its descendants", () => {
    const rows = [
      { id: "pre", parentItemId: null, sortOrder: 0, type: "text_block" },
      { id: "s1", parentItemId: null, sortOrder: 1, type: "section" },
      { id: "c1", parentItemId: "s1", sortOrder: 0, type: "step" },
      { id: "s2", parentItemId: null, sortOrder: 2, type: "section" },
      { id: "c2", parentItemId: "s2", sortOrder: 0, type: "step" },
    ];
    const flat = flattenChecklistTreeForDisplay(rows);
    const groups = groupFlattenedChecklistBySection(flat, rows);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual({ kind: "loose", items: [flat[0]] });
    expect(groups[1]).toMatchObject({ kind: "section", section: flat[1], items: [flat[2]] });
    expect(groups[2]).toMatchObject({ kind: "section", section: flat[3], items: [flat[4]] });
  });

  it("groupFlattenedChecklistBySection gives each nested section its own group", () => {
    const rows = [
      { id: "horno", parentItemId: null, sortOrder: 0, type: "section", label: "horno" },
      { id: "t1", parentItemId: "horno", sortOrder: 0, type: "section", label: "Tarea 1" },
      { id: "f1", parentItemId: "t1", sortOrder: 0, type: "custom_field", fieldType: "number" },
      { id: "t2", parentItemId: "horno", sortOrder: 1, type: "section", label: "Tarea 2" },
      { id: "f2", parentItemId: "t2", sortOrder: 0, type: "custom_field", fieldType: "number" },
    ];
    const flat = flattenChecklistTreeForDisplay(rows);
    const groups = groupFlattenedChecklistBySection(flat, rows);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ kind: "section", section: flat[0], items: [] });
    expect(groups[1]).toMatchObject({ kind: "section", section: flat[1], items: [flat[2]] });
    expect(groups[2]).toMatchObject({ kind: "section", section: flat[3], items: [flat[4]] });
  });

  it("section card only includes tree descendants, not following root siblings", () => {
    const rows = [
      { id: "horno", parentItemId: null, sortOrder: 0, type: "section" },
      { id: "boca", parentItemId: "horno", sortOrder: 0, type: "custom_field" },
      { id: "cuello", parentItemId: "horno", sortOrder: 1, type: "custom_field" },
      { id: "campo", parentItemId: null, sortOrder: 1, type: "custom_field" },
      { id: "texto", parentItemId: null, sortOrder: 2, type: "custom_field" },
      { id: "nuevo", parentItemId: null, sortOrder: 3, type: "custom_field" },
    ];
    const flat = flattenChecklistTreeForDisplay(rows);
    const groups = groupFlattenedChecklistBySection(flat, rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      kind: "section",
      section: flat[0],
      items: [flat[1], flat[2]],
    });
    expect(groups[1]).toEqual({
      kind: "loose",
      items: [flat[3], flat[4], flat[5]],
    });
  });
});
