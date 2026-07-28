CREATE TABLE IF NOT EXISTS asset_groups (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS group_id text REFERENCES asset_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assets_group_id_idx ON assets(group_id);
