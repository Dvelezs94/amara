import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { computeNextWorkOrderFolio } from "@/lib/work-order-folio-helpers";

export { computeNextWorkOrderFolio, INITIAL_WORK_ORDER_FOLIO } from "@/lib/work-order-folio-helpers";

export async function getNextWorkOrderFolio(): Promise<number> {
  const rows = await db
    .select({ max: sql<number>`max(${workOrders.folio})` })
    .from(workOrders);
  return computeNextWorkOrderFolio(rows[0]?.max ?? 0);
}
