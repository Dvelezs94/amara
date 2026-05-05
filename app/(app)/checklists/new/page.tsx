import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChecklistTemplateForm } from "../ChecklistTemplateForm";

export default async function NewChecklistPage() {
  const session = await getSession();
  if (session?.role === "supervisor") {
    redirect("/checklists");
  }
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Nueva plantilla de checklist</h1>
      <ChecklistTemplateForm />
    </div>
  );
}
