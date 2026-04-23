import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAuditLog } from "@/lib/audit";
import { writeUserAvatarImageFile } from "@/lib/user-avatar-file";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    where: eq(users.id, session.id),
    columns: { avatarUrl: true },
  });

  await db
    .update(users)
    .set({ avatarUrl: fileUrl })
    .where(eq(users.id, session.id));

  await recordAuditLog({
    entityType: "user",
    entityId: session.id,
    action: "avatar_updated",
    userId: session.id,
    metadata: {
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
