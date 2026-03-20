import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";

const INITIAL_FOLIO = 2000;

export async function getNextWorkOrderFolio(): Promise<number> {
  const rows = await db
    .select({ max: sql<number>`max(${workOrders.folio})` })
    .from(workOrders);
  const max = Number(rows[0]?.max ?? 0);
  return Math.max(INITIAL_FOLIO, max + 1);
}
