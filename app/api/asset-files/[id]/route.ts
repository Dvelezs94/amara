import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteFileFromS3ByPublicUrl, presignS3PublicUrl } from "@/lib/s3-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await db.query.assetFiles.findFirst({
    where: eq(assetFiles.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const signedUrl = presignS3PublicUrl(row.fileUrl);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "json") {
    return NextResponse.json({ url: signedUrl });
  }
  return NextResponse.redirect(signedUrl, { status: 302 });
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
  const row = await db.query.assetFiles.findFirst({
    where: eq(assetFiles.id, id),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.assetId == null && session.role !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores pueden eliminar archivos de la base de conocimiento" },
      { status: 403 }
    );
  }
  try {
    await deleteFileFromS3ByPublicUrl(row.fileUrl);
  } catch {
    // ignore storage deletion failures; DB row will still be removed
  }
  await db.delete(assetFiles).where(eq(assetFiles.id, id));
  return NextResponse.json({ ok: true });
}
