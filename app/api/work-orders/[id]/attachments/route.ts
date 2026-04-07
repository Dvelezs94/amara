import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";

const UPLOAD_DIR_FS = "public/uploads/work-orders";
const UPLOAD_DIR_PUBLIC = "uploads/work-orders";

const ALLOWED_PREFIX = "image/";

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
  const { id: workOrderId } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, workOrderId),
    orderBy: [desc(attachments.createdAt)],
  });
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      fileUrl: r.fileUrl.startsWith("/public/")
        ? r.fileUrl.replace("/public/", "/")
        : r.fileUrl,
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
  const { id: workOrderId } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (wo.status === "completed") {
    return NextResponse.json(
      { error: "No se pueden subir fotos a una orden completada" },
      { status: 403 }
    );
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
  if (!mime.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { error: "Solo se permiten archivos de imagen" },
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
  const id = createId();
  const displayName = baseName + ext || file.name;

  await db.insert(attachments).values({
    id,
    workOrderId,
    userId: session.id,
    fileUrl,
    filename: displayName,
  });

  await recordAuditLog({
    entityType: "work_order_attachment",
    entityId: id,
    action: "photo_uploaded",
    userId: session.id,
    metadata: {
      workOrderId,
      filename: displayName,
      fileUrl,
    },
  });

  return NextResponse.json({
    id,
    workOrderId,
    fileUrl,
    filename: displayName,
    createdAt: new Date().toISOString(),
  });
}
