import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getPublicUserProfile,
  getUserWorkOrderStats,
  getWorkOrdersForUserProfile,
} from "@/lib/user-profile";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await getPublicUserProfile(id);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const showEmail = session.role === "admin" || session.id === id;
  const [stats, workOrders] = await Promise.all([
    getUserWorkOrderStats(id),
    getWorkOrdersForUserProfile(id, 80),
  ]);

  return NextResponse.json({
    user: {
      ...user,
      email: showEmail ? user.email : null,
    },
    stats,
    workOrders,
  });
}
