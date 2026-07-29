export type KnowledgeFileKind = "pdf" | "image" | "other";

export function ensureFileScheme(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

export function inlinePdfWebViewUri(uri: string, platformOs: string): string {
  if (platformOs === "android" && (uri.startsWith("http://") || uri.startsWith("https://"))) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}`;
  }
  return uri;
}

export function looksLikePdf(filename: string | null | undefined, urlOrPath: string): boolean {
  const name = (filename ?? "").trim().toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const pathOnly = urlOrPath.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return pathOnly.endsWith(".pdf");
}

export function looksLikeImageFilename(filename: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(filename.trim());
}

export function isLikelyInternalDownloadUrl(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/api/work-orders/") || urlOrPath.startsWith("/api/asset-files/")) {
    return true;
  }
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      return (
        parsed.pathname.startsWith("/api/work-orders/") ||
        parsed.pathname.startsWith("/api/asset-files/")
      );
    } catch {
      return false;
    }
  }
  return false;
}

export function isLikelyInternalApiUrl(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/api/")) return true;
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const parsed = new URL(urlOrPath);
      return parsed.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }
  return false;
}

export function knowledgeFileKind(filename: string, fileUrl: string): KnowledgeFileKind {
  if (looksLikePdf(filename, fileUrl)) return "pdf";
  if (looksLikeImageFilename(filename)) return "image";
  return "other";
}
