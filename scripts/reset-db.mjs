#!/usr/bin/env node

/**
 * Drops all objects in `public` (PostgreSQL). Requires DATABASE_URL.
 * After reset, run `npm run db:push` then `npm run db:seed` if desired.
 */

import { Client } from "pg";

function requirePostgresUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    console.error(
      "This project uses PostgreSQL only. Set DATABASE_URL to a postgres connection string."
    );
    process.exit(1);
  }
  return url;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const connectionString = requirePostgresUrl();

  if (dryRun) {
    console.log(`[dry-run] Would reset schema for: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("PostgreSQL public schema reset. Run: npm run db:push");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to reset database:", error);
  process.exit(1);
});
