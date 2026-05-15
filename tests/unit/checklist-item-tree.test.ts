import { describe, expect, it } from "vitest";
import {
  flattenChecklistTreeForDisplay,
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
});
