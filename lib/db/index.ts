import { join } from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_PATH ?? join(process.cwd(), "sqlite.db");
const sqlite = new Database(dbPath);

// Backward-compat: older DBs may not have this column yet.
// We add it opportunistically to avoid runtime failures in calendar APIs.
const scheduleColumns = sqlite
  .prepare("PRAGMA table_info('maintenance_schedules')")
  .all() as Array<{ name?: string }>;
const hasAssigneeColumn = scheduleColumns.some((col) => col.name === "assignee_id");
if (!hasAssigneeColumn) {
  sqlite.prepare("ALTER TABLE maintenance_schedules ADD COLUMN assignee_id TEXT").run();
}
const hasColorColumn = scheduleColumns.some((col) => col.name === "color");
if (!hasColorColumn) {
  sqlite.prepare("ALTER TABLE maintenance_schedules ADD COLUMN color TEXT").run();
}
const requestColumns = sqlite
  .prepare("PRAGMA table_info('requests')")
  .all() as Array<{ name?: string }>;
const hasRequestPriorityColumn = requestColumns.some(
  (col) => col.name === "priority"
);
if (!hasRequestPriorityColumn) {
  sqlite
    .prepare(
      "ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'"
    )
    .run();
}
const workOrderColumns = sqlite
  .prepare("PRAGMA table_info('work_orders')")
  .all() as Array<{ name?: string }>;
const hasWorkOrderFolioColumn = workOrderColumns.some((col) => col.name === "folio");
if (!hasWorkOrderFolioColumn) {
  sqlite.prepare("ALTER TABLE work_orders ADD COLUMN folio INTEGER").run();
}
sqlite
  .prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS work_orders_folio_unique_idx ON work_orders (folio) WHERE folio IS NOT NULL"
  )
  .run();
const missingFolioRows = sqlite
  .prepare(
    "SELECT id FROM work_orders WHERE folio IS NULL ORDER BY datetime(created_at) ASC, id ASC"
  )
  .all() as Array<{ id: string }>;
if (missingFolioRows.length > 0) {
  const maxRow = sqlite
    .prepare("SELECT max(folio) as maxFolio FROM work_orders")
    .get() as { maxFolio: number | null };
  let next = Math.max(2000, Number(maxRow.maxFolio ?? 0) + 1);
  const updateFolio = sqlite.prepare("UPDATE work_orders SET folio = ? WHERE id = ?");
  const tx = sqlite.transaction((rows: Array<{ id: string }>) => {
    for (const row of rows) {
      updateFolio.run(next, row.id);
      next += 1;
    }
  });
  tx(missingFolioRows);
}

export const db = drizzle(sqlite, { schema });
