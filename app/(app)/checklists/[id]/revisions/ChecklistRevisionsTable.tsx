"use client";

import Link from "next/link";
import { useState } from "react";
import type { RevisionListItem } from "@/lib/checklist-template-revisions-ui";

const PAGE_SIZE = 5;

type SerializableRevision = Omit<RevisionListItem, "createdAt"> & { createdAt: string };

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

export function ChecklistRevisionsTable({
  checklistId,
  revisions,
  sessionId,
  canAuthor,
  canReview,
}: {
  checklistId: string;
  revisions: SerializableRevision[];
  sessionId: string | null;
  canAuthor: boolean;
  canReview: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = revisions.slice(0, visibleCount);
  const hasMore = visibleCount < revisions.length;

  return (
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
          {revisions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                No hay revisiones en este filtro.
              </td>
            </tr>
          ) : (
            visible.map((rev) => {
              const isOwnDraft =
                rev.status === "draft" && sessionId && rev.proposedByUserId === sessionId;
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
                          href={`/checklists/${checklistId}/revisions/${rev.id}`}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Ver
                        </Link>
                      )}
                      {isVirtual && (
                        <Link
                          href={`/checklists/${checklistId}`}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Ver plantilla
                        </Link>
                      )}
                      {canAuthor && isOwnDraft && (
                        <Link
                          href={`/checklists/${checklistId}/revisions/${rev.id}/edit`}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                      {canReview && rev.status === "proposed" && !isVirtual && (
                        <Link
                          href={`/checklists/${checklistId}/revisions/${rev.id}`}
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
      {hasMore ? (
        <div className="border-t border-zinc-200 px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cargar más
          </button>
        </div>
      ) : null}
    </div>
  );
}
