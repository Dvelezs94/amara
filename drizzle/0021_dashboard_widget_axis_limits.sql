-- Per-widget manual/auto axis limits for analytics charts.
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS axis_limits jsonb NOT NULL DEFAULT '{"yAuto":true,"yMin":null,"yMax":null,"xAuto":true,"xMin":null,"xMax":null}'::jsonb;
