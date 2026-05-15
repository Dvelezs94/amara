import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { checklistTemplateItems, workOrderChecklist } from "@/lib/db/schema";
import { buildWorkOrderChecklistIdMapFromTemplateRows } from "@/lib/work-order-checklist-id-map";

/** Copies all template checklist rows onto a work order (calendar and manual create use this). */
export async function copyChecklistTemplateItemsToWorkOrder(opts: {
  workOrderId: string;
  checklistTemplateId: string;
  newId: () => string;
}): Promise<void> {
  const { workOrderId, checklistTemplateId, newId } = opts;
  const templateItems = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, checklistTemplateId),
    orderBy: (items, { asc: a }) => [a(items.sortOrder)],
  });
  const idMap = buildWorkOrderChecklistIdMapFromTemplateRows(templateItems, newId);
  for (const it of templateItems) {
    const rowId = idMap.get(it.id);
    if (!rowId) {
      throw new Error(
        `copyChecklistTemplateItemsToWorkOrder: missing mapped id for template item ${it.id}`
      );
    }
    await db.insert(workOrderChecklist).values({
      id: rowId,
      workOrderId,
      checklistTemplateId,
      parentItemId: it.parentItemId ? idMap.get(it.parentItemId) ?? null : null,
      type: it.type,
      label: it.label,
      sortOrder: it.sortOrder,
      completed: false,
      fieldType: it.fieldType,
      options: it.options,
      isOptional: it.isOptional ?? false,
    });
  }
}
