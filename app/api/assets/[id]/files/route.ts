import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { assetFiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { recordAuditLog } from "@/lib/audit";

const UPLOAD_DIR_FS = "public/uploads/asset-files";
const UPLOAD_DIR_PUBLIC = "uploads/asset-files";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: assetId } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  const files = await db.query.assetFiles.findMany({
    where: eq(assetFiles.assetId, assetId),
    orderBy: [desc(assetFiles.createdAt)],
  });
  return NextResponse.json(
    files.map((f) => ({
      ...f,
      fileUrl: `/api/asset-files/${f.id}`,
    }))
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: assetId } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  let formData: globalThis.FormData;
  try {
    formData = (await req.formData()) as unknown as globalThis.FormData;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string)?.trim() || null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const baseName = sanitizeFilename(file.name.slice(0, file.name.length - ext.length));
  const uniqueName = `${createId()}${ext || ""}`;
  const dir = join(process.cwd(), UPLOAD_DIR_FS);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, uniqueName);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const fileUrl = `/${UPLOAD_DIR_PUBLIC}/${uniqueName}`;
  const id = createId();
  await db.insert(assetFiles).values({
    id,
    assetId,
    filename: baseName + ext || file.name,
    fileUrl,
    category,
  });

  await recordAuditLog({
    entityType: "asset_file",
    entityId: id,
    action: "file_uploaded",
    userId: session.id,
    metadata: {
      assetId,
      assetHumanId: asset.assetId,
      filename: baseName + ext || file.name,
      fileUrl,
      category,
    },
  });

  return NextResponse.json({
    id,
    assetId,
    filename: baseName + ext || file.name,
    fileUrl,
    category,
  });
}
