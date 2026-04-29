import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments, workOrders } from "@/lib/db/schema";
import { presignS3PublicUrl } from "@/lib/s3-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: workOrderId, attachmentId } = await params;
  const wo = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, workOrderId),
    columns: { id: true },
  });
  if (!wo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const row = await db.query.attachments.findFirst({
    where: and(eq(attachments.id, attachmentId), eq(attachments.workOrderId, workOrderId)),
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.redirect(presignS3PublicUrl(row.fileUrl), { status: 302 });
}
