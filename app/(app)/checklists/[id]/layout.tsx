import { notFound } from "next/navigation";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { ChecklistSubnav } from "./ChecklistSubnav";

export default async function ChecklistTemplateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const template = await getChecklistTemplateById(params.id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <ChecklistSubnav checklistId={params.id} templateName={template.name} />
      {children}
    </div>
  );
}
