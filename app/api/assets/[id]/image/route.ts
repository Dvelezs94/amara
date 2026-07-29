import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { assetImageProxyPath } from "@/lib/asset-image-helpers";
import { writeAssetImageFile } from "@/lib/asset-image-file";
import {
  deleteFileFromS3ByPublicUrl,
  presignS3PublicUrl,
} from "@/lib/s3-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
    columns: { id: true, imageUrl: true },
  });
  if (!asset?.imageUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const signedUrl = presignS3PublicUrl(asset.imageUrl);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "json") {
    return NextResponse.json({ url: signedUrl });
  }
  return NextResponse.redirect(signedUrl, { status: 302 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
    columns: { id: true, imageUrl: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let formData: globalThis.FormData;
  try {
    formData = (await req.formData()) as unknown as globalThis.FormData;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  let fileUrl: string;
  let displayName: string;
  try {
    const saved = await writeAssetImageFile(file);
    fileUrl = saved.fileUrl;
    displayName = saved.displayName;
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_TYPE") {
      return NextResponse.json(
        { error: "Solo se permiten imágenes" },
        { status: 400 }
      );
    }
    throw e;
  }

  const previousUrl = asset.imageUrl ?? null;
  const now = new Date();
  await db
    .update(assets)
    .set({ imageUrl: fileUrl, updatedAt: now })
    .where(eq(assets.id, id));

  if (previousUrl && previousUrl !== fileUrl) {
    await deleteFileFromS3ByPublicUrl(previousUrl).catch(() => undefined);
  }

  await recordAuditLog({
    entityType: "asset",
    entityId: id,
    action: "image_updated",
    userId: session.id,
    metadata: { before: previousUrl, after: fileUrl },
  });

  return NextResponse.json({
    ok: true,
    imageUrl: assetImageProxyPath(id, now.getTime()),
    filename: displayName,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
    columns: { id: true, imageUrl: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const previousUrl = asset.imageUrl ?? null;
  if (!previousUrl) {
    return NextResponse.json({ ok: true, imageUrl: null });
  }

  await db
    .update(assets)
    .set({ imageUrl: null, updatedAt: new Date() })
    .where(eq(assets.id, id));

  await deleteFileFromS3ByPublicUrl(previousUrl).catch(() => undefined);

  await recordAuditLog({
    entityType: "asset",
    entityId: id,
    action: "image_removed",
    userId: session.id,
    metadata: { before: previousUrl, after: null },
  });

  return NextResponse.json({ ok: true, imageUrl: null });
}
