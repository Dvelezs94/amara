import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { recordAuditLog } from "@/lib/audit";

const UPLOAD_DIR_FS = "public/uploads/avatars";
const UPLOAD_DIR_PUBLIC = "uploads/avatars";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mime = file.type || "";
  if (!mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "Solo se permiten imagenes" },
      { status: 400 }
    );
  }

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".jpg";
  const baseName = sanitizeFilename(
    file.name.slice(0, file.name.length - ext.length)
  );
  const uniqueName = `${createId()}${ext}`;
  const dir = join(process.cwd(), UPLOAD_DIR_FS);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, uniqueName);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const fileUrl = `/${UPLOAD_DIR_PUBLIC}/${uniqueName}`;
  const displayName = baseName + ext || file.name;

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
