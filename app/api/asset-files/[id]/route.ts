import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { toDiskPathFromFileUrl } from "@/lib/file-storage";

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
