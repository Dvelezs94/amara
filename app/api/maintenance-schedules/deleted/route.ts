import { NextResponse } from "next/server";
import { desc, isNotNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceSchedules } from "@/lib/db/schema";

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_PAGE_SIZE)
  );
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);
  const fetchLimit = pageSize + 1;

  const rows = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      deletedAt: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(isNotNull(maintenanceSchedules.deletedAt))
    .orderBy(desc(maintenanceSchedules.deletedAt))
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > pageSize;
  const slice = hasMore ? rows.slice(0, pageSize) : rows;

  return NextResponse.json({
    items: slice.map((r) => ({
      id: r.id,
      name: r.name,
      deletedAt: r.deletedAt?.toISOString() ?? null,
    })),
    hasMore,
    limit: pageSize,
    offset,
  });
}
