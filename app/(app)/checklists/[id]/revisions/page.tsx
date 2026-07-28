import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { getChecklistRevisions } from "@/lib/checklist-template-revisions-ui";
import { SetPageHeader } from "@/components/SetPageHeader";
import { ChecklistRevisionsTable } from "./ChecklistRevisionsTable";

export default async function ChecklistRevisionsHubPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { filter?: string; notice?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = params;
  const template = await getChecklistTemplateById(id);
  if (!template) notFound();

  const all = await getChecklistRevisions(id);
  const allowed = ["all", "draft", "proposed", "approved", "rejected"] as const;
  const rawFilter = (searchParams?.filter ?? "all").toLowerCase();
  const filter = allowed.includes(rawFilter as (typeof allowed)[number])
    ? (rawFilter as (typeof allowed)[number])
    : "all";
  const filtered =
    filter === "draft"
      ? all.filter((r) => r.status === "draft")
      : filter === "proposed"
        ? all.filter((r) => r.status === "proposed")
        : filter === "approved"
          ? all.filter((r) => r.status === "approved")
          : filter === "rejected"
            ? all.filter((r) => r.status === "rejected")
            : all;

  const notice = searchParams?.notice;
  const canAuthor = session.role !== "calidad";
  const canReview = session.role === "calidad";

  const filterLink = (f: string) => {
    const qs = new URLSearchParams();
    if (f !== "all") qs.set("filter", f);
    const q = qs.toString();
    return q ? `/checklists/${id}/revisions?${q}` : `/checklists/${id}/revisions`;
  };

  return (
    <div className="space-y-4">
      <SetPageHeader
        title="Revisiones"
        subtitle={template.name}
        actions={
          canAuthor ? (
            <Link
              href={`/checklists/${id}/revisions/new`}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Nueva revisión
            </Link>
          ) : null
        }
      />
      <p className="max-w-2xl text-sm text-zinc-600">
        Cada cambio a la plantilla pasa por una revisión con nombre y número, como una solicitud de
        incorporación de cambios. Las propuestas en revisión las aprueba o rechaza calidad; los
        borradores puedes editarlos hasta enviarlos.
      </p>

      {notice === "revision_submitted" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Revisión enviada. Calidad debe aprobarla para que se aplique a la plantilla publicada.
        </p>
      )}
      {notice === "draft_saved" && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Borrador guardado. Sigue editando o envía a revisión cuando esté listo.
        </p>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-sm">
        {(
          [
            ["all", "Todas"],
            ["draft", "Borradores"],
            ["proposed", "En revisión"],
            ["approved", "Aprobadas"],
            ["rejected", "Rechazadas"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={filterLink(key)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              filter === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <ChecklistRevisionsTable
        key={filter}
        checklistId={id}
        revisions={filtered.map((rev) => ({
          ...rev,
          createdAt: rev.createdAt.toISOString(),
        }))}
        sessionId={session.id}
        sessionRole={session.role}
        canAuthor={canAuthor}
        canReview={canReview}
      />
    </div>
  );
}
