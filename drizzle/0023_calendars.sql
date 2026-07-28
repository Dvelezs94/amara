CREATE TABLE IF NOT EXISTS calendars (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS calendar_id text REFERENCES calendars(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS maintenance_schedules_calendar_id_idx
  ON maintenance_schedules(calendar_id);
