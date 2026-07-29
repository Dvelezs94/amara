import { describe, expect, it } from "vitest";
import {
  buildPublicAttachmentUrlMaps,
  extractInlineFilesFromRewrittenNote,
  publicAttachmentDownloadPath,
  rewriteNoteBodyToPublicDownloadUrls,
} from "@/lib/solicitud-public-note-urls";

describe("publicAttachmentDownloadPath", () => {
  it("builds folio query path", () => {
    expect(publicAttachmentDownloadPath("att1", 2005)).toBe(
      "/api/solicitud/attachments/att1/download?folio=2005"
    );
  });
});

describe("buildPublicAttachmentUrlMaps", () => {
  it("maps by id and fileUrl", () => {
    const { byId, byUrl } = buildPublicAttachmentUrlMaps(
      [{ id: "a1", fileUrl: "https://s3.example/x.pdf" }],
      10
    );
    expect(byId.get("a1")).toContain("/api/solicitud/attachments/a1/download");
    expect(byUrl.get("https://s3.example/x.pdf")).toBe(byId.get("a1"));
  });
});

describe("rewriteNoteBodyToPublicDownloadUrls", () => {
  it("rewrites fileid tokens", () => {
    const { byId, byUrl } = buildPublicAttachmentUrlMaps(
      [{ id: "a1", fileUrl: "https://s3.example/x.pdf" }],
      99
    );
    const out = rewriteNoteBodyToPublicDownloadUrls(
      "Ver [[fileid:a1|foto.jpg]] aqui",
      99,
      byId,
      byUrl
    );
    expect(out).toContain("[[file:foto.jpg|");
    expect(out).toContain("/api/solicitud/attachments/a1/download?folio=99");
  });

  it("rewrites file tokens by url map", () => {
    const { byId, byUrl } = buildPublicAttachmentUrlMaps(
      [{ id: "a1", fileUrl: "https://s3.example/x.pdf" }],
      7
    );
    const out = rewriteNoteBodyToPublicDownloadUrls(
      "[[file:doc.pdf|https://s3.example/x.pdf]]",
      7,
      byId,
      byUrl
    );
    expect(out).toContain("/api/solicitud/attachments/a1/download?folio=7");
  });
});

describe("extractInlineFilesFromRewrittenNote", () => {
  it("splits text and files", () => {
    const { text, files } = extractInlineFilesFromRewrittenNote(
      "Hola [[file:foto%20a.jpg|/api/solicitud/attachments/a1/download?folio=1]] mundo"
    );
    expect(text).toBe("Hola  mundo");
    expect(files).toEqual([
      {
        filename: "foto a.jpg",
        url: "/api/solicitud/attachments/a1/download?folio=1",
      },
    ]);
  });
});
