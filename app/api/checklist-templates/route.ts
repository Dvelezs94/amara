import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { createId } from "@/lib/id";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db
    .select()
    .from(checklistTemplates)
    .orderBy(desc(checklistTemplates.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const id = createId();
  await db.insert(checklistTemplates).values({
    id,
    name,
    description: body.description?.trim() || null,
  });
  return NextResponse.json({ id });
}
