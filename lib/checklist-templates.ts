import { db } from "@/lib/db";
import { checklistTemplates } from "@/lib/db/schema";
import { checklistTemplateItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getChecklistTemplateById(id: string) {
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, id),
  });
  if (!template) return null;
  const items = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, id),
    orderBy: (items, { asc }) => [asc(items.sortOrder)],
  });
  return { ...template, items };
}
