ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "chart_type" text NOT NULL DEFAULT 'line';
