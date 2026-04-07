import { join } from "path";

export function normalizePublicFileUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  if (fileUrl.startsWith("/public/")) return fileUrl.replace("/public/", "/");
  if (!fileUrl.startsWith("/")) return `/${fileUrl}`;
  return fileUrl;
}

export function toDiskPathFromFileUrl(fileUrl: string): string {
  const normalized = normalizePublicFileUrl(fileUrl);
  return join(process.cwd(), "public", normalized.slice(1));
}
