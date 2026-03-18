import { notFound } from "next/navigation";
import Link from "next/link";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { ChecklistTemplateForm } from "../ChecklistTemplateForm";

export default async function EditChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getChecklistTemplateById(id);
  if (!template) notFound();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Editar plantilla de checklist</h1>
      <ChecklistTemplateForm templateId={id} initial={template} />
      <Link href="/checklists" className="inline-block text-sm text-primary-600 font-medium">
        Volver a checklist
      </Link>
    </div>
  );
}
