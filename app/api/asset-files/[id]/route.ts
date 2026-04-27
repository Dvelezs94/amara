import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readFile, unlink } from "fs/promises";
import { toDiskPathFromFileUrl } from "@/lib/file-storage";

function contentTypeFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".bmp")) return "image/bmp";
  if (n.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(
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
  const filePath = toDiskPathFromFileUrl(row.fileUrl);
  try {
    const bytes = await readFile(filePath);
    const headers = new Headers();
    headers.set("Content-Type", contentTypeFromFilename(row.filename));
    headers.set("Content-Disposition", `inline; filename="${row.filename.replace(/"/g, "")}"`);
    return new NextResponse(bytes, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado en almacenamiento." }, { status: 404 });
  }
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
  const filePath = toDiskPathFromFileUrl(row.fileUrl);
  try {
    await unlink(filePath);
  } catch {
    // ignore if file already missing
  }
  await db.delete(assetFiles).where(eq(assetFiles.id, id));
  return NextResponse.json({ ok: true });
}
