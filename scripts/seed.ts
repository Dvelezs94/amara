/**
 * Seed script: run with `npx tsx scripts/seed.ts`
 * Creates a demo user and sample data if DB is empty.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcrypt from "bcryptjs";
import { join } from "path";
import * as schema from "../lib/db/schema";

const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), "sqlite.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function seed() {
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length > 0) {
    console.log("DB already has users, skipping seed.");
    return;
  }
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await db.insert(schema.users).values({
    id,
    email: "demo@amimaint.local",
    name: "Demo User",
    passwordHash,
    role: "technician",
  });
  console.log("Created demo user: demo@amimaint.local / demo1234");
}

seed().catch(console.error).finally(() => sqlite.close());
