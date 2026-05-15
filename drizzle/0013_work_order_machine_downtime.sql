ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "counts_machine_downtime" boolean DEFAULT false NOT NULL;
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "manual_downtime_minutes" integer DEFAULT 0 NOT NULL;
