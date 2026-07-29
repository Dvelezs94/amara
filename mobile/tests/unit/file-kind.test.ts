import { describe, expect, it } from "vitest";
import {
  ensureFileScheme,
  inlinePdfWebViewUri,
  isLikelyInternalApiUrl,
  isLikelyInternalDownloadUrl,
  knowledgeFileKind,
  looksLikeImageFilename,
  looksLikePdf,
} from "../../lib/file-kind";

describe("looksLikePdf / looksLikeImageFilename", () => {
  it("detects pdf by name or path", () => {
    expect(looksLikePdf("a.pdf", "/x")).toBe(true);
    expect(looksLikePdf(null, "/docs/manual.pdf?x=1")).toBe(true);
    expect(looksLikePdf("a.txt", "/x")).toBe(false);
  });
  it("detects images", () => {
    expect(looksLikeImageFilename("foto.JPG")).toBe(true);
    expect(looksLikeImageFilename("a.pdf")).toBe(false);
  });
});

describe("knowledgeFileKind", () => {
  it("classifies files", () => {
    expect(knowledgeFileKind("a.pdf", "/a")).toBe("pdf");
    expect(knowledgeFileKind("a.png", "/a")).toBe("image");
    expect(knowledgeFileKind("a.docx", "/a")).toBe("other");
  });
});

describe("url helpers", () => {
  it("ensureFileScheme", () => {
    expect(ensureFileScheme("file:///tmp/a")).toBe("file:///tmp/a");
    expect(ensureFileScheme("/tmp/a")).toBe("file:///tmp/a");
  });
  it("inlinePdfWebViewUri wraps android http", () => {
    const out = inlinePdfWebViewUri("https://x/a.pdf", "android");
    expect(out).toContain("docs.google.com/gview");
    expect(inlinePdfWebViewUri("https://x/a.pdf", "ios")).toBe("https://x/a.pdf");
  });
  it("detects internal urls", () => {
    expect(isLikelyInternalDownloadUrl("/api/work-orders/1/attachments/2/download")).toBe(
      true
    );
    expect(isLikelyInternalApiUrl("/api/users/me")).toBe(true);
    expect(isLikelyInternalApiUrl("https://host/api/x")).toBe(true);
    expect(isLikelyInternalApiUrl("https://host/public/x")).toBe(false);
  });
});
