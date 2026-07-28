import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { ChecklistTemplateForm } from "../../../ChecklistTemplateForm";

export default async function NewChecklistRevisionPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "calidad") {
    redirect(`/checklists/${params.id}/revisions`);
  }

  const template = await getChecklistTemplateById(params.id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-zinc-600">
        Indica un nombre de revisión y modifica la plantilla respecto a la versión publicada. Puedes
        guardar como borrador tantas veces como necesites; al enviar a revisión, calidad decidirá si se
        fusiona con la plantilla publicada.
      </p>
      <ChecklistTemplateForm
        templateId={params.id}
        initial={template}
        cancelHref={`/checklists/${params.id}/revisions`}
        revisionsHubHref={`/checklists/${params.id}/revisions`}
      />
    </div>
  );
}
