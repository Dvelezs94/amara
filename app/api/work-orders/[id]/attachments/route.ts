import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { attachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { uploadFileToS3 } from "@/lib/s3-storage";

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
      fileUrl: `/api/work-orders/${workOrderId}/attachments/${r.id}/download`,
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
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".bin";
  const baseName = sanitizeFilename(
    file.name.slice(0, file.name.length - ext.length)
  );
  const uniqueName = `${createId()}${ext}`;
  const objectKey = `work-orders/${uniqueName}`;
  const bytes = await file.arrayBuffer();
  const fileUrl = await uploadFileToS3({
    objectKey,
    bytes: Buffer.from(bytes),
    contentType: file.type || "application/octet-stream",
  });
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
    action: "file_uploaded",
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
    fileUrl: `/api/work-orders/${workOrderId}/attachments/${id}/download`,
    filename: displayName,
    createdAt: new Date().toISOString(),
  });
}
