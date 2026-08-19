import { NextResponse } from "next/server";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import { resolveRevisionSaveStatus } from "@/lib/checklist-revision-save";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checklistTemplateItems,
  checklistTemplateRevisions,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { notifyCalidadUsersChecklistRevisionProposed } from "@/lib/notifications";
import { parseChecklistTemplateItemsFromClientJson } from "@/lib/checklist-items-from-payload";
import { emitWorkflowEvent } from "@/lib/workflow-engine";
import { buildWorkflowEvent } from "@/lib/workflows";

async function getCurrentTemplateSnapshot(templateId: string) {
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) return null;
  const items = await db.query.checklistTemplateItems.findMany({
    where: eq(checklistTemplateItems.checklistTemplateId, templateId),
    orderBy: (it, { asc }) => [asc(it.sortOrder)],
  });
  return {
    name: template.name,
    description: template.description ?? null,
    items: items.map((it) => ({
      id: it.id,
      parentItemId: it.parentItemId ?? null,
      type: it.type,
      label: it.label,
      fieldType: it.fieldType ?? null,
      options: (Array.isArray(it.options) ? it.options : null) as string[] | null,
      ...(it.isOptional ? { isOptional: true } : {}),
    })),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const rows = await db
    .select({
      id: checklistTemplateRevisions.id,
      revisionNumber: checklistTemplateRevisions.revisionNumber,
      name: checklistTemplateRevisions.name,
      status: checklistTemplateRevisions.status,
      createdAt: checklistTemplateRevisions.createdAt,
      proposedByUserId: checklistTemplateRevisions.proposedByUserId,
      proposedByName: users.name,
      reviewedByUserId: checklistTemplateRevisions.reviewedByUserId,
      reviewedAt: checklistTemplateRevisions.reviewedAt,
      reviewComment: checklistTemplateRevisions.reviewComment,
      snapshot: checklistTemplateRevisions.snapshot,
    })
    .from(checklistTemplateRevisions)
    .leftJoin(users, eq(checklistTemplateRevisions.proposedByUserId, users.id))
    .where(eq(checklistTemplateRevisions.checklistTemplateId, id))
    .orderBy(desc(checklistTemplateRevisions.revisionNumber), desc(checklistTemplateRevisions.createdAt));
  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "calidad") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: templateId } = await params;
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const submissionAction =
    body.submissionAction === "submit_review" ? "submit_review" : "save";
  const draftRevisionId =
    typeof body.draftRevisionId === "string" && body.draftRevisionId.trim()
      ? body.draftRevisionId.trim()
      : null;
  const revisionName = String(body.revisionName ?? "").trim();
  if (!revisionName) {
    return NextResponse.json(
      { error: "Nombre de revision requerido" },
      { status: 400 }
    );
  }
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  const description =
    body.description === undefined ? null : (body.description?.trim() ?? null);
  const rawItems: Array<Record<string, unknown>> = Array.isArray(body.items)
    ? (body.items as Array<Record<string, unknown>>)
    : [];
  const { items: parsedItems, error: itemsError } =
    parseChecklistTemplateItemsFromClientJson(rawItems);
  if (itemsError) {
    return NextResponse.json({ error: itemsError }, { status: 400 });
  }
  const items = parsedItems.map((p) => ({
    id: p.clientId,
    parentItemId: p.parentClientId,
    type: p.type,
    label: p.label,
    fieldType: p.fieldType,
    options: p.options,
    ...(p.isOptional ? { isOptional: true } : {}),
  }));

  const before = await getCurrentTemplateSnapshot(templateId);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const existingRevision = draftRevisionId
    ? await db.query.checklistTemplateRevisions.findFirst({
        where: and(
          eq(checklistTemplateRevisions.checklistTemplateId, templateId),
          eq(checklistTemplateRevisions.id, draftRevisionId),
          eq(checklistTemplateRevisions.proposedByUserId, session.id),
          inArray(checklistTemplateRevisions.status, ["draft", "proposed"])
        ),
      })
    : await db.query.checklistTemplateRevisions.findFirst({
        where: and(
          eq(checklistTemplateRevisions.checklistTemplateId, templateId),
          eq(checklistTemplateRevisions.proposedByUserId, session.id),
          eq(checklistTemplateRevisions.status, "draft")
        ),
        orderBy: [desc(checklistTemplateRevisions.createdAt)],
      });
  const existingStatus =
    existingRevision?.status === "draft" || existingRevision?.status === "proposed"
      ? existingRevision.status
      : null;
  const status = resolveRevisionSaveStatus(submissionAction, existingStatus);
  const normalizedName = revisionName.toLocaleLowerCase("es-MX");
  const existingRevisions = await db
    .select({ id: checklistTemplateRevisions.id, name: checklistTemplateRevisions.name })
    .from(checklistTemplateRevisions)
    .where(eq(checklistTemplateRevisions.checklistTemplateId, templateId));
  const duplicateName = existingRevisions.some((rev) => {
    if (existingRevision && rev.id === existingRevision.id) return false;
    return rev.name.trim().toLocaleLowerCase("es-MX") === normalizedName;
  });
  if (duplicateName) {
    return NextResponse.json(
      { error: "Ya existe una revisión con ese número" },
      { status: 409 }
    );
  }

  let revisionNumber = existingRevision?.revisionNumber ?? null;
  let revisionId = existingRevision?.id ?? null;
  if (existingRevision) {
    await db
      .update(checklistTemplateRevisions)
      .set({
        name: revisionName,
        status,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewComment: null,
        snapshot: {
          before,
          after: { name, description, items },
        },
        createdAt: now,
      })
      .where(eq(checklistTemplateRevisions.id, existingRevision.id));
  } else {
    const [{ value: maxRevision }] = await db
      .select({
        value: max(checklistTemplateRevisions.revisionNumber),
      })
      .from(checklistTemplateRevisions)
      .where(eq(checklistTemplateRevisions.checklistTemplateId, templateId));

    const nextRevisionNumber = (maxRevision ?? -1) + 1;
    const createdId = createId();
    await db.insert(checklistTemplateRevisions).values({
      id: createdId,
      checklistTemplateId: templateId,
      revisionNumber: nextRevisionNumber,
      name: revisionName,
      status,
      proposedByUserId: session.id,
      reviewedByUserId: null,
      reviewedAt: null,
      snapshot: {
        before,
        after: { name, description, items },
      },
      createdAt: now,
    });
    revisionNumber = nextRevisionNumber;
    revisionId = createdId;
  }

  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: status === "proposed" ? "revision_proposed" : "revision_draft_saved",
    userId: session.id,
    metadata: {
      revisionId,
      revisionNumber,
      revisionName,
      status,
    },
  });

  if (status === "proposed" && revisionId) {
    await notifyCalidadUsersChecklistRevisionProposed({
      templateId,
      revisionId,
      templateName: template.name,
      revisionName,
      proposedByUserId: session.id,
      proposedByName: session.name ?? null,
    });
    await emitWorkflowEvent(
      buildWorkflowEvent({
        type: "checklist_revision.proposed",
        entityType: "checklist_template",
        entityId: templateId,
        actorUserId: session.id,
        actorName: session.name,
        payload: {
          title: template.name,
          href: `/checklists/${templateId}/revisions/${revisionId}`,
          requesterId: session.id,
          revisionName,
        },
      })
    );
  }

  return NextResponse.json({ ok: true, status, revisionNumber, revisionId });
}
