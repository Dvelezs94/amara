/** Client-safe helpers for machine photo URLs (no Node/S3 imports). */

export function sanitizeAssetImageFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.replace(/^[_]+$/, "") || "file";
}

/** Same-origin path that redirects to a short-lived S3 GET URL. */
export function assetImageProxyPath(
  assetId: string,
  cacheKey?: string | number | Date | null
): string {
  const id = assetId.trim();
  const base = `/api/assets/${encodeURIComponent(id)}/image`;
  if (cacheKey == null || cacheKey === "") return base;
  const v =
    cacheKey instanceof Date ? String(cacheKey.getTime()) : String(cacheKey);
  return `${base}?v=${encodeURIComponent(v)}`;
}
