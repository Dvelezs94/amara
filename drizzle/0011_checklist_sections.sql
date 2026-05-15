-- Allow 'section' headers in checklist templates and work-order checklist copies.
ALTER TABLE checklist_template_items DROP CONSTRAINT IF EXISTS checklist_template_items_type_check;
ALTER TABLE checklist_template_items ADD CONSTRAINT checklist_template_items_type_check
  CHECK (type IN ('step', 'custom_field', 'text_block', 'section'));

ALTER TABLE work_order_checklist DROP CONSTRAINT IF EXISTS work_order_checklist_type_check;
ALTER TABLE work_order_checklist ADD CONSTRAINT work_order_checklist_type_check
  CHECK (type IN ('step', 'custom_field', 'text_block', 'section'));
