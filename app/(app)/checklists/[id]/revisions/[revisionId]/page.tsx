import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { db } from "@/lib/db";
import { checklistTemplateRevisions, users } from "@/lib/db/schema";
import { ChecklistRevisionInspect } from "../../ChecklistRevisionInspect";

export default async function ChecklistRevisionDetailPage({
  params,
}: {
  params: { id: string; revisionId: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: checklistId, revisionId } = params;
  if (revisionId === "revision-0-virtual") {
    redirect(`/checklists/${checklistId}`);
  }

  const template = await getChecklistTemplateById(checklistId);
  if (!template) notFound();

  const row = await db
    .select({
      id: checklistTemplateRevisions.id,
      name: checklistTemplateRevisions.name,
      revisionNumber: checklistTemplateRevisions.revisionNumber,
      status: checklistTemplateRevisions.status,
      createdAt: checklistTemplateRevisions.createdAt,
      proposedByUserId: checklistTemplateRevisions.proposedByUserId,
      reviewComment: checklistTemplateRevisions.reviewComment,
      snapshot: checklistTemplateRevisions.snapshot,
      userName: users.name,
    })
    .from(checklistTemplateRevisions)
    .leftJoin(users, eq(checklistTemplateRevisions.proposedByUserId, users.id))
    .where(
      and(
        eq(checklistTemplateRevisions.id, revisionId),
        eq(checklistTemplateRevisions.checklistTemplateId, checklistId)
      )
    )
    .limit(1);

  const revision = row[0];
  if (!revision) notFound();

  const canReview = session.role === "calidad";
  const showEditDraftLink =
    session.role !== "calidad" &&
    revision.status === "draft" &&
    revision.proposedByUserId === session.id;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <ChecklistRevisionInspect
          revision={{
            id: revision.id,
            action: revision.status,
            name: revision.name,
            revisionNumber: revision.revisionNumber,
            status: revision.status,
            createdAt: revision.createdAt.toISOString(),
            userName: revision.userName,
            reviewComment: revision.reviewComment,
            metadata: revision.snapshot ?? null,
          }}
          checklistId={checklistId}
          canReview={canReview}
          showEditDraftLink={showEditDraftLink}
        />
      </div>
    </div>
  );
}
