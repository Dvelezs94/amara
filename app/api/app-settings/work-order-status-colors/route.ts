import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWorkOrderStatusColors } from "@/lib/work-order-status-colors-db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const colors = await getWorkOrderStatusColors();
  return NextResponse.json({ colors });
}
