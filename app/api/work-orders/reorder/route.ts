import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const boardStatuses = new Set(["open", "in_progress", "completed"] as const);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  const orderedIds = body.orderedIds as unknown;

  if (!status || !boardStatuses.has(status as "open" | "in_progress" | "completed")) {
    return NextResponse.json({ error: "Estado de columna no válido" }, { status: 400 });
  }
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedIds inválido" }, { status: 400 });
  }

  const ids = orderedIds as string[];
  const existing = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.status, status));

  const existingSet = new Set(existing.map((r) => r.id));
  if (existingSet.size !== ids.length) {
    return NextResponse.json(
      { error: "La lista no coincide con las tareas de la columna" },
      { status: 400 }
    );
  }
  for (const id of ids) {
    if (!existingSet.has(id)) {
      return NextResponse.json(
        { error: "La lista no coincide con las tareas de la columna" },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i += 1) {
      await tx
        .update(workOrders)
        .set({ boardSortOrder: i, updatedAt: now })
        .where(eq(workOrders.id, ids[i]!));
    }
  });

  return NextResponse.json({ ok: true });
}
