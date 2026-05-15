import { describe, expect, it } from "vitest";
import { buildWorkOrderChecklistIdMapFromTemplateRows } from "@/lib/work-order-checklist-id-map";

describe("buildWorkOrderChecklistIdMapFromTemplateRows", () => {
  it("assigns a distinct new id for every template row", () => {
    let n = 0;
    const newId = () => `new-${++n}`;
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const map = buildWorkOrderChecklistIdMapFromTemplateRows(rows, newId);
    expect(map.size).toBe(3);
    expect(map.get("a")).toBe("new-1");
    expect(map.get("b")).toBe("new-2");
    expect(map.get("c")).toBe("new-3");
    expect(map.get("a")).not.toBe(map.get("b"));
  });

  it("returns empty map for empty template list", () => {
    const map = buildWorkOrderChecklistIdMapFromTemplateRows([], () => "x");
    expect(map.size).toBe(0);
  });
});
