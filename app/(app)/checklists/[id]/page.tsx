import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500" aria-label="Migas de pan">
        <Link
          href="/checklists"
          className="inline-flex items-center gap-1 font-medium text-[#F14C03] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Checklist
        </Link>
        <span aria-hidden className="text-zinc-400">
          /
        </span>
        <span className="text-zinc-600">Editar plantilla</span>
      </nav>
      <h1 className="text-xl font-semibold text-zinc-900">Editar plantilla de checklist</h1>
      <ChecklistTemplateForm templateId={id} initial={template} />
    </div>
  );
}
