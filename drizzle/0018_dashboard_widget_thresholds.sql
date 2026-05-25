ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "thresholds" jsonb NOT NULL DEFAULT '[]'::jsonb;
