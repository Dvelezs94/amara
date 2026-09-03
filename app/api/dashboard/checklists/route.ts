import { NextResponse } from "next/server";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  dayBoundsInAppTimeZone,
  groupChecklistsByWorkOrder,
  todayYmdInAppTimeZone,
} from "@/lib/dashboard-checklists";
import { isValidYmd } from "@/lib/dashboard-date-range";
import { db } from "@/lib/db";
import {
  checklistTemplates,
  notes,
  workOrderChecklist,
  workOrders,
} from "@/lib/db/schema";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const dateYmd =
    dateParam && isValidYmd(dateParam) ? dateParam : todayYmdInAppTimeZone();
  const bounds = dayBoundsInAppTimeZone(dateYmd);
  if (!bounds) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const activeWorkOrders = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(
      or(
        and(
          gte(workOrders.updatedAt, bounds.start),
          lte(workOrders.updatedAt, bounds.end)
        ),
        and(
          gte(workOrders.completedAt, bounds.start),
          lte(workOrders.completedAt, bounds.end)
        ),
        sql`exists (
          select 1 from ${notes}
          where ${notes.workOrderId} = ${workOrders.id}
            and ${notes.createdAt} >= ${bounds.start}
            and ${notes.createdAt} <= ${bounds.end}
        )`
      )
    );

  const workOrderIds = activeWorkOrders.map((row) => row.id);
  if (workOrderIds.length === 0) {
    return NextResponse.json({ date: dateYmd, checklists: [] });
  }

  const [checklistRows, noteRows, workOrderRows] = await Promise.all([
    db
      .select({
        workOrderId: workOrderChecklist.workOrderId,
        checklistTemplateId: workOrderChecklist.checklistTemplateId,
        type: workOrderChecklist.type,
        fieldType: workOrderChecklist.fieldType,
        value: workOrderChecklist.value,
        completed: workOrderChecklist.completed,
        isOptional: workOrderChecklist.isOptional,
      })
      .from(workOrderChecklist)
      .where(inArray(workOrderChecklist.workOrderId, workOrderIds)),
    db
      .select({ workOrderId: notes.workOrderId })
      .from(notes)
      .where(inArray(notes.workOrderId, workOrderIds)),
    db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
      })
      .from(workOrders)
      .where(inArray(workOrders.id, workOrderIds)),
  ]);

  const workOrderHasNotes: Record<string, boolean> = {};
  for (const note of noteRows) {
    workOrderHasNotes[note.workOrderId] = true;
  }

  const grouped = groupChecklistsByWorkOrder(checklistRows, workOrderHasNotes).filter(
    (group) => group.totalCount > 0
  );

  const templateIds = [
    ...new Set(
      grouped
        .map((group) => group.checklistTemplateId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const templateRows =
    templateIds.length > 0
      ? await db
          .select({ id: checklistTemplates.id, name: checklistTemplates.name })
          .from(checklistTemplates)
          .where(inArray(checklistTemplates.id, templateIds))
      : [];
  const templateNameById = new Map(templateRows.map((row) => [row.id, row.name]));
  const workOrderById = new Map(workOrderRows.map((row) => [row.id, row]));

  const checklists = grouped
    .map((group) => {
      const workOrder = workOrderById.get(group.workOrderId);
      if (!workOrder) return null;
      return {
        workOrderId: group.workOrderId,
        workOrderTitle: workOrder.title,
        workOrderStatus: workOrder.status,
        templateName:
          (group.checklistTemplateId
            ? templateNameById.get(group.checklistTemplateId)
            : null) ?? "Checklist",
        completedCount: group.completedCount,
        totalCount: group.totalCount,
        isPriority: group.isPriority,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return a.workOrderTitle.localeCompare(b.workOrderTitle, "es");
    });

  return NextResponse.json({ date: dateYmd, checklists });
}
