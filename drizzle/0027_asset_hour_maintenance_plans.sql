CREATE TABLE IF NOT EXISTS "asset_hour_maintenance_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "asset_id" text NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "hours_per_day" real NOT NULL,
  "every_hours" real NOT NULL,
  "start_date" text NOT NULL,
  "calendar_id" text REFERENCES "calendars"("id") ON DELETE SET NULL,
  "checklist_template_id" text,
  "color" text,
  "schedule_id" text NOT NULL REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_hour_maintenance_plans_schedule_uidx"
  ON "asset_hour_maintenance_plans" ("schedule_id");

CREATE INDEX IF NOT EXISTS "asset_hour_maintenance_plans_asset_idx"
  ON "asset_hour_maintenance_plans" ("asset_id");
