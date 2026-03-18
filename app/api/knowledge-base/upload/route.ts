import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetFiles } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";

const UPLOAD_DIR = "public/uploads/asset-files";

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
  const category = (formData.get("category") as string)?.trim() || null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const baseName = sanitizeFilename(file.name.slice(0, file.name.length - ext.length));
  const uniqueName = `${createId()}${ext || ""}`;
  const dir = join(process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, uniqueName);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const fileUrl = `/${UPLOAD_DIR}/${uniqueName}`;
  const id = createId();
  await db.insert(assetFiles).values({
    id,
    assetId: null,
    filename: baseName + ext || file.name,
    fileUrl,
    category,
  });

  return NextResponse.json({
    id,
    assetId: null,
    filename: baseName + ext || file.name,
    fileUrl,
    category,
    createdAt: new Date().toISOString(),
  });
}
