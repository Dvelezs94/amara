/**
 * Maps each `checklist_template_items.id` to a new primary key for `work_order_checklist`.
 * Must run before inserting WO rows so `parentItemId` can point at copied section ids.
 */
export function buildWorkOrderChecklistIdMapFromTemplateRows(
  templateRows: readonly { id: string }[],
  newId: () => string
): Map<string, string> {
  const idMap = new Map<string, string>();
  for (const row of templateRows) {
    idMap.set(row.id, newId());
  }
  return idMap;
}
