ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "field_labels" jsonb;
UPDATE "dashboard_widgets" SET "field_labels" = jsonb_build_array("field_label") WHERE "field_labels" IS NULL;
ALTER TABLE "dashboard_widgets" ALTER COLUMN "field_labels" SET DEFAULT '[]'::jsonb;
ALTER TABLE "dashboard_widgets" ALTER COLUMN "field_labels" SET NOT NULL;
