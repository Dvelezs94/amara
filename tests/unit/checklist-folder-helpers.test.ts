import { describe, expect, it } from "vitest";
import {
  folderDescendantIds,
  folderMoveCreatesCycle,
} from "@/lib/checklist-folder-helpers";

describe("folderDescendantIds", () => {
  it("collects nested children", () => {
    const folders = [
      { id: "a", parentFolderId: null },
      { id: "b", parentFolderId: "a" },
      { id: "c", parentFolderId: "b" },
    ];
    expect(folderDescendantIds("a", folders)).toEqual(new Set(["b", "c"]));
    expect(folderDescendantIds("b", folders)).toEqual(new Set(["c"]));
    expect(folderDescendantIds("c", folders)).toEqual(new Set());
  });
});

describe("folderMoveCreatesCycle", () => {
  it("detects self-parent", () => {
    expect(folderMoveCreatesCycle("x", "x", [])).toBe(true);
  });

  it("allows move to root", () => {
    expect(folderMoveCreatesCycle("x", null, [])).toBe(false);
  });

  it("detects moving under a descendant", () => {
    const folders = [
      { id: "a", parentFolderId: null },
      { id: "b", parentFolderId: "a" },
      { id: "c", parentFolderId: "b" },
    ];
    expect(folderMoveCreatesCycle("a", "c", folders)).toBe(true);
    expect(folderMoveCreatesCycle("a", "b", folders)).toBe(true);
    expect(folderMoveCreatesCycle("b", "c", folders)).toBe(true);
  });

  it("allows valid reparent", () => {
    const folders = [
      { id: "a", parentFolderId: null },
      { id: "b", parentFolderId: null },
      { id: "c", parentFolderId: "a" },
    ];
    expect(folderMoveCreatesCycle("c", "b", folders)).toBe(false);
    expect(folderMoveCreatesCycle("b", "a", folders)).toBe(false);
  });
});
