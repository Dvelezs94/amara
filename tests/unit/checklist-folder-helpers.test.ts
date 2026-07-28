import { describe, expect, it } from "vitest";
import {
  filterChecklistsBySearch,
  folderAncestorIds,
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

describe("folderAncestorIds", () => {
  it("returns root-first ancestors", () => {
    const folders = [
      { id: "a", parentFolderId: null },
      { id: "b", parentFolderId: "a" },
      { id: "c", parentFolderId: "b" },
    ];
    expect(folderAncestorIds("c", folders)).toEqual(["a", "b"]);
    expect(folderAncestorIds("a", folders)).toEqual([]);
  });
});

describe("filterChecklistsBySearch", () => {
  const folders = [
    { id: "a", name: "Producción", parentFolderId: null },
    { id: "b", name: "Hornos", parentFolderId: "a" },
    { id: "c", name: "Empaque", parentFolderId: null },
  ];
  const templates = [
    {
      id: "t1",
      name: "Checklist diario",
      description: "Extractor de humos",
      folderId: "b",
    },
    {
      id: "t2",
      name: "Limpieza",
      description: null,
      folderId: null,
    },
    {
      id: "t3",
      name: "Otro",
      description: "nada",
      folderId: "c",
    },
  ];

  it("returns all when query empty", () => {
    const r = filterChecklistsBySearch(folders, templates, "  ");
    expect(r.searching).toBe(false);
    expect(r.templates).toHaveLength(3);
    expect(r.visibleFolderIds).toBeNull();
  });

  it("matches template name and keeps ancestor folders", () => {
    const r = filterChecklistsBySearch(folders, templates, "diario");
    expect(r.searching).toBe(true);
    expect(r.templates.map((t) => t.id)).toEqual(["t1"]);
    expect(r.visibleFolderIds).toEqual(new Set(["a", "b"]));
    expect(r.openFolderIds.has("a")).toBe(true);
    expect(r.openFolderIds.has("b")).toBe(true);
  });

  it("matches description and unfoldered templates", () => {
    const r = filterChecklistsBySearch(folders, templates, "limpieza");
    expect(r.templates.map((t) => t.id)).toEqual(["t2"]);
    expect(r.visibleFolderIds?.size).toBe(0);
  });

  it("matches folder name", () => {
    const r = filterChecklistsBySearch(folders, templates, "empaque");
    expect(r.visibleFolderIds).toEqual(new Set(["c"]));
    expect(r.templates.map((t) => t.id)).toEqual(["t3"]);
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
