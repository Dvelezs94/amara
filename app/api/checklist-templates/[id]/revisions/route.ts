import { NextResponse } from "next/server";
import { and, desc, eq, max } from "drizzle-orm";
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
import { createNotification } from "@/lib/notifications";

type RevisionItem = {
  type: string;
  label: string;
  fieldType: string | null;
  options: string[] | null;
};

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
      type: it.type,
      label: it.label,
      fieldType: it.fieldType ?? null,
      options: (Array.isArray(it.options) ? it.options : null) as string[] | null,
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
  const { id: templateId } = await params;
  const template = await db.query.checklistTemplates.findFirst({
    where: eq(checklistTemplates.id, templateId),
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const revisionName = String(body.revisionName ?? "").trim();
  if (!revisionName) {
    return NextResponse.json(
      { error: "Nombre de revision requerido" },
      { status: 400 }
    );
  }
  const existingRevisions = await db
    .select({ name: checklistTemplateRevisions.name })
    .from(checklistTemplateRevisions)
    .where(
      and(
        eq(checklistTemplateRevisions.checklistTemplateId, templateId),
        eq(checklistTemplateRevisions.status, "approved")
      )
    );
  const normalizedName = revisionName.toLocaleLowerCase("es-MX");
  const nameTaken = existingRevisions.some(
    (rev) => rev.name.trim().toLocaleLowerCase("es-MX") === normalizedName
  );
  if (nameTaken) {
    return NextResponse.json(
      { error: "Ya existe una revisión con ese nombre" },
      { status: 409 }
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
  const items: RevisionItem[] = rawItems.map((it: Record<string, unknown>) => ({
    type:
      it.type === "custom_field" || it.type === "text_block" || it.type === "step"
        ? it.type
        : "step",
    label: String(it.label ?? "").trim() || "Elemento",
    fieldType: it.fieldType ? String(it.fieldType) : null,
    options:
      Array.isArray(it.options) && it.fieldType === "dropdown"
        ? it.options.map((opt: unknown) => String(opt))
        : null,
  }));

  const before = await getCurrentTemplateSnapshot(templateId);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ value: maxRevision }] = await db
    .select({
      value: max(checklistTemplateRevisions.revisionNumber),
    })
    .from(checklistTemplateRevisions)
    .where(eq(checklistTemplateRevisions.checklistTemplateId, templateId));

  const nextRevisionNumber = (maxRevision ?? -1) + 1;
  const now = new Date();
  const status = session.role === "supervisor" ? "approved" : "proposed";
  await db.insert(checklistTemplateRevisions).values({
    id: createId(),
    checklistTemplateId: templateId,
    revisionNumber: nextRevisionNumber,
    name: revisionName,
    status,
    proposedByUserId: session.id,
    reviewedByUserId: status === "approved" ? session.id : null,
    reviewedAt: status === "approved" ? now : null,
    snapshot: {
      before,
      after: { name, description, items },
    },
    createdAt: now,
  });

  await recordAuditLog({
    entityType: "checklist_template",
    entityId: templateId,
    action: status === "approved" ? "revision_approved" : "revision_proposed",
    userId: session.id,
    metadata: {
      revisionNumber: nextRevisionNumber,
      revisionName,
      status,
    },
  });

  const supervisors = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "supervisor"));
  try {
    await Promise.all(
      supervisors.map((sup) =>
        createNotification({
          userId: sup.id,
          type: "work_order_update",
          title: "Nueva revisión de checklist",
          body: `[checklist:${templateId}] ${template.name} · Revision ${revisionName}`,
        })
      )
    );
  } catch {
    // Do not fail revision creation if notifications fail.
  }

  if (status === "approved") {
    await db.update(checklistTemplates).set({ name, description }).where(eq(checklistTemplates.id, templateId));
    await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.checklistTemplateId, templateId));
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]!;
      await db.insert(checklistTemplateItems).values({
        id: createId(),
        checklistTemplateId: templateId,
        type: it.type as "step" | "custom_field" | "text_block",
        label: it.label,
        sortOrder: i,
        fieldType: it.fieldType as
          | "text"
          | "number"
          | "date"
          | "dropdown"
          | "checkbox"
          | "photo"
          | "title"
          | "subtitle"
          | "paragraph"
          | null,
        options: it.options,
      });
    }
  }

  return NextResponse.json({ ok: true, status, revisionNumber: nextRevisionNumber });
}
