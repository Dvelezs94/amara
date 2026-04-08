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

const hasWorkOrderKindColumn = workOrderColumns.some((col) => col.name === "kind");
if (!hasWorkOrderKindColumn) {
  sqlite
    .prepare(
      "ALTER TABLE work_orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'on_demand'"
    )
    .run();
  sqlite
    .prepare(
      `UPDATE work_orders SET kind = 'routine' WHERE id IN (
        SELECT entity_id FROM audit_logs
        WHERE entity_type = 'work_order' AND action = 'created_from_schedule'
      )`
    )
    .run();
}

const workOrderColumnsAfterKind = sqlite
  .prepare("PRAGMA table_info('work_orders')")
  .all() as Array<{ name?: string }>;
const hasBoardSortOrderColumn = workOrderColumnsAfterKind.some(
  (col) => col.name === "board_sort_order"
);
if (!hasBoardSortOrderColumn) {
  sqlite
    .prepare(
      "ALTER TABLE work_orders ADD COLUMN board_sort_order INTEGER NOT NULL DEFAULT 0"
    )
    .run();
}

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      work_order_id TEXT REFERENCES work_orders(id) ON DELETE CASCADE,
      note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
      read_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
    `
  )
  .run();
sqlite
  .prepare(
    "CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC)"
  )
  .run();
sqlite
  .prepare(
    "CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at)"
  )
  .run();

export const db = drizzle(sqlite, { schema });
