import { join } from "path";
import { describe, expect, it } from "vitest";
import { normalizePublicFileUrl, toDiskPathFromFileUrl } from "@/lib/file-storage";

describe("normalizePublicFileUrl", () => {
  it("strips /public prefix", () => {
    expect(normalizePublicFileUrl("/public/uploads/a.pdf")).toBe("/uploads/a.pdf");
  });
  it("adds leading slash", () => {
    expect(normalizePublicFileUrl("uploads/a.pdf")).toBe("/uploads/a.pdf");
  });
  it("keeps absolute path", () => {
    expect(normalizePublicFileUrl("/uploads/a.pdf")).toBe("/uploads/a.pdf");
  });
  it("passes through empty", () => {
    expect(normalizePublicFileUrl("")).toBe("");
  });
});

describe("toDiskPathFromFileUrl", () => {
  it("joins cwd/public", () => {
    expect(toDiskPathFromFileUrl("/uploads/a.pdf")).toBe(
      join(process.cwd(), "public", "uploads/a.pdf")
    );
  });
});
