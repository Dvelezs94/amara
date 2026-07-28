import { describe, expect, it } from "vitest";
import {
  filterAssetGroupSections,
  partitionAssetsByGroup,
  sortAssetGroups,
} from "@/lib/asset-group-helpers";

describe("sortAssetGroups", () => {
  it("sorts by sortOrder then name", () => {
    const sorted = sortAssetGroups([
      { id: "b", name: "Beta", sortOrder: 1 },
      { id: "a", name: "Alfa", sortOrder: 0 },
      { id: "c", name: "Charlie", sortOrder: 0 },
    ]);
    expect(sorted.map((g) => g.id)).toEqual(["a", "c", "b"]);
  });
});

describe("partitionAssetsByGroup", () => {
  it("puts assets into ordered group sections then ungrouped", () => {
    const groups = [
      { id: "g2", name: "Empaque", sortOrder: 1 },
      { id: "g1", name: "Hornos", sortOrder: 0 },
    ];
    const assets = [
      { id: "a1", groupId: "g1" },
      { id: "a2", groupId: null },
      { id: "a3", groupId: "g2" },
      { id: "a4", groupId: "missing" },
    ];
    const sections = partitionAssetsByGroup(assets, groups);
    expect(sections.map((s) => s.groupId)).toEqual(["g1", "g2", null]);
    expect(sections[0].assets.map((a) => a.id)).toEqual(["a1"]);
    expect(sections[1].assets.map((a) => a.id)).toEqual(["a3"]);
    expect(sections[2].assets.map((a) => a.id)).toEqual(["a2", "a4"]);
  });

  it("includes empty groups", () => {
    const sections = partitionAssetsByGroup([], [
      { id: "g1", name: "Vacío", sortOrder: 0 },
    ]);
    expect(sections).toEqual([
      { groupId: "g1", assets: [] },
      { groupId: null, assets: [] },
    ]);
  });
});

describe("filterAssetGroupSections", () => {
  it("keeps empty named groups when not searching", () => {
    const sections = [
      { groupId: "g1", assets: [] as { groupId: string | null }[] },
      { groupId: null, assets: [] },
    ];
    expect(filterAssetGroupSections(sections, { searching: false })).toEqual([
      { groupId: "g1", assets: [] },
    ]);
  });

  it("hides empty sections while searching", () => {
    const sections = [
      { groupId: "g1", assets: [] as { groupId: string | null }[] },
      { groupId: "g2", assets: [{ groupId: "g2" }] },
      { groupId: null, assets: [] },
    ];
    expect(filterAssetGroupSections(sections, { searching: true })).toEqual([
      { groupId: "g2", assets: [{ groupId: "g2" }] },
    ]);
  });
});
