import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { createId } from "@/lib/id";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db
    .select({
      id: calendars.id,
      name: calendars.name,
      sortOrder: calendars.sortOrder,
    })
    .from(calendars)
    .orderBy(asc(calendars.sortOrder), asc(calendars.name));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const siblings = await db
    .select({ sortOrder: calendars.sortOrder })
    .from(calendars);
  const sortOrder = siblings.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;

  const id = createId();
  await db.insert(calendars).values({
    id,
    name,
    sortOrder,
  });
  return NextResponse.json({ id });
}
