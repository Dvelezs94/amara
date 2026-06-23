import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checklistTemplateItems,
  checklistTemplateRevisions,
  checklistTemplates,
} from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import {
  mapChecklistItemsToInsertRows,
  parseChecklistTemplateItemsFromClientJson,
} from "@/lib/checklist-items-from-payload";
import { canDeleteChecklistRevision } from "@/lib/checklist-revision-delete";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: templateId, revisionId } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
  if (!decision) {
    return NextResponse.json({ error: "Decision invalida" }, { status: 400 });
  }

  const revision = await db.query.checklistTemplateRevisions.findFirst({
    where: and(
      eq(checklistTemplateRevisions.id, revisionId),
      eq(checklistTemplateRevisions.checklistTemplateId, templateId)
    ),
  });
  if (!revision) {
    return NextResponse.json({ error: "Revision no encontrada" }, { status: 404 });
  }
  if (revision.status !== "proposed") {
    return NextResponse.json({ error: "La revision ya fue procesada" }, { status: 400 });
  }

  const now = new Date();
  const status = decision === "approve" ? "approved" : "rejected";
  await db
    .update(checklistTemplateRevisions)
    .set({
      status,
      reviewedByUserId: session.id,
      reviewedAt: now,
      reviewComment: body.comment ? String(body.comment).trim() : null,
    })
    .where(eq(checklistTemplateRevisions.id, revisionId));

  if (decision === "approve") {
    const after = revision.snapshot.after;
    const rawItems = Array.isArray(after.items)
      ? (after.items as Array<Record<string, unknown>>)
      : [];
    const { items: parsed, error } = parseChecklistTemplateItemsFromClientJson(rawItems);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const insertRows = mapChecklistItemsToInsertRows(parsed, createId);
    await db
      .update(checklistTemplates)
      .set({ name: after.name, description: after.description })
      .where(eq(checklistTemplates.id, templateId));
    await db
      .delete(checklistTemplateItems)
      .where(eq(checklistTemplateItems.checklistTemplateId, templateId));
    for (const row of insertRows) {
      await db.insert(checklistTemplateItems).values({
        id: row.id,
        checklistTemplateId: templateId,
        parentItemId: row.parentItemId,
        type: row.type,
        label: row.label,
        sortOrder: row.sortOrder,
        fieldType: row.fieldType,
        options: row.options,
        isOptional: row.isOptional,
      });
    }
  }

  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: decision === "approve" ? "revision_approved" : "revision_rejected",
    userId: session.id,
    metadata: {
      revisionId,
      revisionNumber: revision.revisionNumber,
      revisionName: revision.name,
      comment: body.comment ? String(body.comment).trim() : null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: templateId, revisionId } = await params;
  const revision = await db.query.checklistTemplateRevisions.findFirst({
    where: and(
      eq(checklistTemplateRevisions.id, revisionId),
      eq(checklistTemplateRevisions.checklistTemplateId, templateId)
    ),
  });
  if (!revision) {
    return NextResponse.json({ error: "Revisión no encontrada" }, { status: 404 });
  }

  if (
    !canDeleteChecklistRevision(session.role, session.id, {
      id: revision.id,
      status: revision.status,
      proposedByUserId: revision.proposedByUserId,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(checklistTemplateRevisions)
    .where(eq(checklistTemplateRevisions.id, revisionId));

  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: "revision_deleted",
    userId: session.id,
    metadata: {
      revisionId,
      revisionNumber: revision.revisionNumber,
      revisionName: revision.name,
      status: revision.status,
    },
  });

  return NextResponse.json({ ok: true });
}
