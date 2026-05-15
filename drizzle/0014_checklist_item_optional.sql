ALTER TABLE "checklist_template_items" ADD COLUMN IF NOT EXISTS "is_optional" boolean DEFAULT false NOT NULL;
ALTER TABLE "work_order_checklist" ADD COLUMN IF NOT EXISTS "is_optional" boolean DEFAULT false NOT NULL;
