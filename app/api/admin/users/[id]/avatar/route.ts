import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import { writeUserAvatarImageFile } from "@/lib/user-avatar-file";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { id: true, username: true },
  });
  if (!target) {
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
    const saved = await writeUserAvatarImageFile(file);
    fileUrl = saved.fileUrl;
    displayName = saved.displayName;
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_TYPE") {
      return NextResponse.json(
        { error: "Solo se permiten imagenes" },
        { status: 400 }
      );
    }
    throw e;
  }

  const before = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { avatarUrl: true },
  });

  await db
    .update(users)
    .set({ avatarUrl: fileUrl })
    .where(eq(users.id, targetId));

  await recordAuditLog({
    entityType: "user",
    entityId: targetId,
    action: "avatar_updated_by_admin",
    userId: session.id,
    metadata: {
      targetUsername: target.username,
      before: before?.avatarUrl ?? null,
      after: fileUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    avatarUrl: fileUrl,
    filename: displayName,
  });
}
