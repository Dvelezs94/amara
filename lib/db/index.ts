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

export const db = drizzle(sqlite, { schema });
