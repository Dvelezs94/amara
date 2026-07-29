import { describe, expect, it } from "vitest";
import {
  assetImageProxyPath,
  sanitizeAssetImageFilename,
} from "@/lib/asset-image-helpers";

describe("sanitizeAssetImageFilename", () => {
  it("keeps safe characters", () => {
    expect(sanitizeAssetImageFilename("motor-01")).toBe("motor-01");
  });
  it("replaces unsafe characters", () => {
    expect(sanitizeAssetImageFilename("foto máquina #2.jpg")).toBe(
      "foto_m_quina__2.jpg"
    );
  });
  it("falls back when empty after sanitize", () => {
    expect(sanitizeAssetImageFilename("!!!")).toBe("file");
  });
  it("truncates long names", () => {
    const long = "a".repeat(200);
    expect(sanitizeAssetImageFilename(long).length).toBe(120);
  });
});

describe("assetImageProxyPath", () => {
  it("returns image API path", () => {
    expect(assetImageProxyPath("abc")).toBe("/api/assets/abc/image");
  });
  it("adds cache key", () => {
    expect(assetImageProxyPath("abc", 123)).toBe("/api/assets/abc/image?v=123");
  });
});
