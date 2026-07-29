import { createId } from "@/lib/id";
import { sanitizeAssetImageFilename } from "@/lib/asset-image-helpers";
import { uploadFileToS3 } from "@/lib/s3-storage";

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
