import { and, desc, eq } from "drizzle-orm";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { db } from "@/lib/db";
import { checklistTemplateRevisions, users } from "@/lib/db/schema";

export type {
  ChecklistInitial,
  ChecklistItemInitial,
} from "@/lib/checklist-template-revisions-ui-helpers";
export {
  buildInitialForDraft,
  normalizeSnapshotItems,
} from "@/lib/checklist-template-revisions-ui-helpers";

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
