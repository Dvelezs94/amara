import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChecklistTemplateById } from "@/lib/checklist-templates";
import { getChecklistRevisions } from "@/lib/checklist-template-revisions-ui";

function statusBadgeClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "draft") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "rejected") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-900 border-amber-200";
}

function statusLabel(status: string) {
  if (status === "approved") return "Aprobada";
  if (status === "draft") return "Borrador";
  if (status === "rejected") return "Rechazada";
  return "En revisión";
}

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Revisiones</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Cada cambio a la plantilla pasa por una revisión con nombre y número, como una solicitud de
            incorporación de cambios. Las propuestas en revisión las aprueba o rechaza calidad; los
            borradores puedes editarlos hasta enviarlos.
          </p>
        </div>
        {canAuthor && (
          <Link
            href={`/checklists/${id}/revisions/new`}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Nueva revisión
          </Link>
        )}
      </div>

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

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Revisión</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No hay revisiones en este filtro.
                </td>
              </tr>
            ) : (
              filtered.map((rev) => {
                const isOwnDraft =
                  rev.status === "draft" &&
                  session.id &&
                  rev.proposedByUserId === session.id;
                const isVirtual = rev.id === "revision-0-virtual";
                return (
                  <tr key={rev.id} className="hover:bg-zinc-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-700">
                      #{rev.revisionNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{rev.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
                          rev.status
                        )}`}
                      >
                        {statusLabel(rev.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{rev.userName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                      {new Date(rev.createdAt).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!isVirtual && (
                          <Link
                            href={`/checklists/${id}/revisions/${rev.id}`}
                            className="text-xs font-medium text-primary-600 hover:underline"
                          >
                            Ver
                          </Link>
                        )}
                        {isVirtual && (
                          <Link
                            href={`/checklists/${id}`}
                            className="text-xs font-medium text-primary-600 hover:underline"
                          >
                            Ver plantilla
                          </Link>
                        )}
                        {canAuthor && isOwnDraft && (
                          <Link
                            href={`/checklists/${id}/revisions/${rev.id}/edit`}
                            className="text-xs font-medium text-primary-600 hover:underline"
                          >
                            Editar
                          </Link>
                        )}
                        {canReview && rev.status === "proposed" && !isVirtual && (
                          <Link
                            href={`/checklists/${id}/revisions/${rev.id}`}
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            Revisar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
