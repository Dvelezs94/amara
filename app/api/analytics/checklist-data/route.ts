import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { workOrderChecklist } from "@/lib/db/schema";
import { checklistTemplates } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * GET ?templateId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns completed work orders that use this checklist template, with checklist item values.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("templateId");
  if (!templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const woWithTemplate = await db
    .selectDistinct({ workOrderId: workOrderChecklist.workOrderId })
    .from(workOrderChecklist)
    .where(eq(workOrderChecklist.checklistTemplateId, templateId));
  const woIds = woWithTemplate.map((r) => r.workOrderId);
  if (woIds.length === 0) {
    return NextResponse.json({
      templateId,
      templateName: template.name,
      workOrders: [],
      fields: [],
    });
  }

  const completedWOs = await db
    .select({ id: workOrders.id, title: workOrders.title, completedAt: workOrders.completedAt })
    .from(workOrders)
    .where(and(eq(workOrders.status, "completed"), inArray(workOrders.id, woIds)));

  let filtered = completedWOs;
  if (from || to) {
    filtered = completedWOs.filter((wo) => {
      if (!wo.completedAt) return false;
      const d = new Date(wo.completedAt).getTime();
      if (from && d < from.getTime()) return false;
      if (to && d > to.getTime()) return false;
      return true;
    });
  }
  const filteredIds = filtered.map((r) => r.id);
  if (filteredIds.length === 0) {
    return NextResponse.json({
      templateId,
      templateName: template.name,
      workOrders: [],
      fields: [],
    });
  }

  const allItems = await db
    .select()
    .from(workOrderChecklist)
    .where(
      and(
        eq(workOrderChecklist.checklistTemplateId, templateId),
        inArray(workOrderChecklist.workOrderId, filteredIds)
      )
    );

  const byWo = new Map<string, typeof allItems>();
  for (const item of allItems) {
    if (!byWo.has(item.workOrderId)) byWo.set(item.workOrderId, []);
    byWo.get(item.workOrderId)!.push(item);
  }

  const workOrdersData = filtered
    .map((wo) => ({
      id: wo.id,
      title: wo.title,
      completedAt: wo.completedAt,
      checklistItems: (byWo.get(wo.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({
          id: i.id,
          label: i.label,
          type: i.type,
          fieldType: i.fieldType,
          value: i.value,
          completed: i.completed,
        })),
    }))
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
    );

  const fieldLabels = new Set<string>();
  for (const wo of workOrdersData) {
    for (const it of wo.checklistItems) {
      if (it.type === "custom_field" && it.label) fieldLabels.add(it.label);
    }
  }

  return NextResponse.json({
    templateId,
    templateName: template.name,
    workOrders: workOrdersData,
    fields: Array.from(fieldLabels),
  });
}
