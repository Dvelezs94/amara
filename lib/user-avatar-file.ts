import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { createId } from "@/lib/id";

export const USER_AVATAR_UPLOAD_DIR_FS = "public/uploads/avatars";
export const USER_AVATAR_UPLOAD_DIR_PUBLIC = "uploads/avatars";

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
  const dir = join(process.cwd(), USER_AVATAR_UPLOAD_DIR_FS);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, uniqueName);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));
  const fileUrl = `/${USER_AVATAR_UPLOAD_DIR_PUBLIC}/${uniqueName}`;
  const displayName = baseName + ext || file.name;
  return { fileUrl, displayName };
}
