import { and, desc, eq } from "drizzle-orm";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { db } from "@/lib/db";
import { checklistTemplateRevisions, users } from "@/lib/db/schema";

export type ChecklistItemInitial = {
  id?: string;
  parentItemId?: string | null;
  type: string;
  label: string;
  fieldType?: string | null;
  options?: string[] | null | unknown;
  isOptional?: boolean;
};

export type ChecklistInitial = {
  name: string;
  description?: string | null;
  items?: ChecklistItemInitial[];
};

export type RevisionListItem = {
  id: string;
  action: string;
  name: string;
  revisionNumber: number;
  status: string;
  createdAt: Date;
  proposedByUserId: string | null;
  userName: string | null;
  reviewComment: string | null;
  metadata: Record<string, unknown> | null;
};

export function normalizeSnapshotItems(
  items: unknown,
  fallbackItems: ChecklistItemInitial[] = []
): ChecklistItemInitial[] {
  if (!Array.isArray(items)) return fallbackItems;
  return items.map((item) => {
    const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      type: String(source.type ?? "custom_field"),
      label: String(source.label ?? ""),
      fieldType: source.fieldType ? String(source.fieldType) : null,
      options: Array.isArray(source.options)
        ? source.options.map((opt) => String(opt))
        : null,
      ...(typeof source.id === "string" && source.id.trim()
        ? { id: source.id.trim() }
        : {}),
      parentItemId:
        typeof source.parentItemId === "string" && source.parentItemId.trim()
          ? source.parentItemId.trim()
          : null,
      ...(source.isOptional === true ? { isOptional: true } : {}),
    };
  });
}

export function buildInitialForDraft(draftAfter: unknown, template: ChecklistInitial): ChecklistInitial {
  if (Array.isArray(draftAfter)) {
    return {
      name: template.name,
      description: template.description ?? null,
      items: normalizeSnapshotItems(draftAfter, template.items),
    };
  }

  if (!draftAfter || typeof draftAfter !== "object") return template;
  const after = draftAfter as Record<string, unknown>;
  return {
    name: typeof after.name === "string" ? after.name : template.name,
    description:
      typeof after.description === "string" || after.description === null
        ? (after.description as string | null)
        : template.description ?? null,
    items: normalizeSnapshotItems(after.items, template.items),
  };
}

export async function getChecklistRevisions(id: string): Promise<RevisionListItem[]> {
  const rows = await db
    .select({
      id: checklistTemplateRevisions.id,
      action: checklistTemplateRevisions.status,
      name: checklistTemplateRevisions.name,
      revisionNumber: checklistTemplateRevisions.revisionNumber,
      status: checklistTemplateRevisions.status,
      createdAt: checklistTemplateRevisions.createdAt,
      proposedByUserId: checklistTemplateRevisions.proposedByUserId,
      userName: users.name,
      reviewComment: checklistTemplateRevisions.reviewComment,
      metadata: checklistTemplateRevisions.snapshot,
    })
    .from(checklistTemplateRevisions)
    .leftJoin(users, eq(checklistTemplateRevisions.proposedByUserId, users.id))
    .where(eq(checklistTemplateRevisions.checklistTemplateId, id))
    .orderBy(desc(checklistTemplateRevisions.revisionNumber))
    .limit(100);

  const mapped = rows.map((row) => ({
    id: row.id,
    action: row.action,
    name: row.name,
    revisionNumber: row.revisionNumber,
    status: row.status,
    createdAt: row.createdAt,
    proposedByUserId: row.proposedByUserId,
    userName: row.userName,
    reviewComment: row.reviewComment,
    metadata: row.metadata ?? null,
  }));
  if (mapped.length > 0) return mapped;

  const template = await getChecklistTemplateById(id);
  if (!template) return [];
  return [
    {
      id: "revision-0-virtual",
      action: "approved",
      name: "Revision 0",
      revisionNumber: 0,
      status: "approved",
      createdAt: template.createdAt,
      proposedByUserId: null,
      userName: null,
      reviewComment: null,
      metadata: {
        after: {
          name: template.name,
          description: template.description ?? null,
          items: (template.items ?? []).map((it) => ({
            id: it.id,
            parentItemId: it.parentItemId ?? null,
            type: it.type,
            label: it.label,
            fieldType: it.fieldType ?? null,
            options: Array.isArray(it.options) ? it.options : null,
          })),
        },
      },
    },
  ];
}
