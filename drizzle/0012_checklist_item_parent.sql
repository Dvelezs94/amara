ALTER TABLE "checklist_template_items" ADD COLUMN IF NOT EXISTS "parent_item_id" text;
ALTER TABLE "work_order_checklist" ADD COLUMN IF NOT EXISTS "parent_item_id" text;

ALTER TABLE "checklist_template_items" DROP CONSTRAINT IF EXISTS "checklist_template_items_parent_item_id_checklist_template_items_id_fk";
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_parent_item_id_checklist_template_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "checklist_template_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "work_order_checklist" DROP CONSTRAINT IF EXISTS "work_order_checklist_parent_item_id_work_order_checklist_id_fk";
ALTER TABLE "work_order_checklist" ADD CONSTRAINT "work_order_checklist_parent_item_id_work_order_checklist_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "work_order_checklist"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
