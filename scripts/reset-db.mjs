#!/usr/bin/env node

import { access, rm } from "node:fs/promises";
import path from "node:path";

function resolveDbPath() {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }

  const drizzleUrl = process.env.DATABASE_URL;
  if (drizzleUrl?.startsWith("file:")) {
    const raw = drizzleUrl.slice("file:".length);
    return path.resolve(process.cwd(), raw);
  }

  return path.resolve(process.cwd(), "sqlite.db");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbPath = resolveDbPath();
  const targets = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];

  console.log(`Database target: ${dbPath}`);
  if (dryRun) {
    console.log("Dry run enabled. No files will be deleted.");
  }

  let deleted = 0;
  for (const target of targets) {
    if (!(await exists(target))) continue;
    if (!dryRun) {
      await rm(target, { force: true });
    }
    deleted += 1;
    console.log(`${dryRun ? "[dry-run] would delete" : "deleted"} ${target}`);
  }

  if (deleted === 0) {
    console.log("No database files found to delete.");
  } else {
    console.log(dryRun ? "Dry run completed." : "Database reset completed.");
  }
}

main().catch((error) => {
  console.error("Failed to reset database:", error);
  process.exit(1);
});
