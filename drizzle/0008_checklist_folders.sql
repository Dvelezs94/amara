CREATE TABLE IF NOT EXISTS checklist_folders (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  parent_folder_id text REFERENCES checklist_folders(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS folder_id text REFERENCES checklist_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS checklist_templates_folder_id_idx ON checklist_templates(folder_id);
