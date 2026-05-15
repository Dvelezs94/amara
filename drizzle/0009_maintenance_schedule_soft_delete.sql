ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS maintenance_schedules_deleted_at_idx ON maintenance_schedules(deleted_at);
