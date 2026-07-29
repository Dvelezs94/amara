import { createId } from "@/lib/id";
import { uploadFileToS3 } from "@/lib/s3-storage";

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

export async function writeAssetImageFile(file: File): Promise<{
  fileUrl: string;
  displayName: string;
}> {
  const mime = file.type || "";
  if (!mime.startsWith("image/")) {
    throw new Error("INVALID_TYPE");
  }
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".jpg";
  const baseName = sanitizeAssetImageFilename(
    file.name.slice(0, file.name.length - ext.length)
  );
  const uniqueName = `${createId()}${ext}`;
  const bytes = await file.arrayBuffer();
  const fileUrl = await uploadFileToS3({
    objectKey: `assets/${uniqueName}`,
    bytes: Buffer.from(bytes),
    contentType: mime,
  });
  const displayName = baseName + ext || file.name;
  return { fileUrl, displayName };
}
