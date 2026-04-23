-- board_sort_order is also added at runtime in lib/db/index.ts for older DBs.
-- This keeps drizzle migrate aligned without failing if the column already exists.
SELECT 1;
