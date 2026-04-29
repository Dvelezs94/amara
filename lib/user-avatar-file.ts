import { createId } from "@/lib/id";
import { uploadFileToS3 } from "@/lib/s3-storage";

export function sanitizeAvatarFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function writeUserAvatarImageFile(file: File): Promise<{
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
  const baseName = sanitizeAvatarFilename(
    file.name.slice(0, file.name.length - ext.length)
  );
  const uniqueName = `${createId()}${ext}`;
  const bytes = await file.arrayBuffer();
  const fileUrl = await uploadFileToS3({
    objectKey: `avatars/${uniqueName}`,
    bytes: Buffer.from(bytes),
    contentType: mime,
  });
  const displayName = baseName + ext || file.name;
  return { fileUrl, displayName };
}
