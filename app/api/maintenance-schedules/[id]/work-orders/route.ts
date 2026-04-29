import { NextResponse } from "next/server";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, workOrders } from "@/lib/db/schema";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const dateYmd = url.searchParams.get("dateYmd")?.trim() ?? "";
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_PAGE_SIZE)
  );
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0);
  /** Fetch one extra row to know if another page exists. */
  const fetchLimit = pageSize + 1;

  let dueDateFilter:
    | ReturnType<typeof and>
    | ReturnType<typeof gte>
    | null = null;
  if (dateYmd) {
    const dayStart = new Date(`${dateYmd}T00:00:00`);
    const dayEnd = new Date(`${dateYmd}T23:59:59.999`);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
      return NextResponse.json({ error: "dateYmd inválida" }, { status: 400 });
    }
    dueDateFilter = and(
      gte(workOrders.dueDate, dayStart),
      lte(workOrders.dueDate, dayEnd)
    );
  }

  const rows = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueDate: workOrders.dueDate,
      createdAt: workOrders.createdAt,
      assigneeId: users.id,
      assigneeName: users.name,
      assigneeAvatarUrl: users.avatarUrl,
    })
    .from(workOrders)
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(
      dueDateFilter
        ? and(
            like(workOrders.description, `%calendario de mantenimiento (${id})%`),
            dueDateFilter
          )
        : like(workOrders.description, `%calendario de mantenimiento (${id})%`)
    )
    .orderBy(desc(workOrders.createdAt), desc(workOrders.id))
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;

  return NextResponse.json({ items, hasMore, limit: pageSize, offset });
}
