import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import {
  buildInitialForDraft,
} from "@/lib/checklist-template-revisions-ui";
import { db } from "@/lib/db";
import { checklistTemplateRevisions } from "@/lib/db/schema";
import { ChecklistTemplateForm } from "../../../../ChecklistTemplateForm";

export default async function EditChecklistRevisionPage({
  params,
  searchParams,
}: {
  params: { id: string; revisionId: string };
  searchParams?: { notice?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "calidad") {
    redirect(`/checklists/${params.id}/revisions`);
  }

  const template = await getChecklistTemplateById(params.id);
  if (!template) notFound();

  const revision = await db.query.checklistTemplateRevisions.findFirst({
    where: and(
      eq(checklistTemplateRevisions.checklistTemplateId, params.id),
      eq(checklistTemplateRevisions.id, params.revisionId),
      eq(checklistTemplateRevisions.status, "draft"),
      eq(checklistTemplateRevisions.proposedByUserId, session.id)
    ),
  });
  if (!revision) notFound();

  const draftAfter = revision.snapshot?.after;
  const initialForEdit = buildInitialForDraft(draftAfter, template);

  const notice = searchParams?.notice;

  return (
    <div className="space-y-4">
      {notice === "draft_saved" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Borrador guardado.
        </p>
      )}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Editar borrador</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Revisión <span className="font-semibold text-zinc-800">{revision.name}</span> (#
          {revision.revisionNumber}) · borrador no enviado
        </p>
      </div>
      <ChecklistTemplateForm
        key={revision.id}
        templateId={params.id}
        initial={initialForEdit}
        initialRevisionName={revision.name}
        draftRevisionId={revision.id}
        cancelHref={`/checklists/${params.id}/revisions`}
        revisionsHubHref={`/checklists/${params.id}/revisions`}
      />
    </div>
  );
}
