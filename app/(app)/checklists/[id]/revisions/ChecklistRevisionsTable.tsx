"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { canDeleteChecklistRevision } from "@/lib/checklist-revision-delete";
import type { UserRole } from "@/lib/auth-shared";
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
  sessionRole,
  canAuthor,
  canReview,
}: {
  checklistId: string;
  revisions: SerializableRevision[];
  sessionId: string | null;
  sessionRole: UserRole;
  canAuthor: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<SerializableRevision | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const visible = revisions.slice(0, visibleCount);
  const hasMore = visibleCount < revisions.length;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/checklist-templates/${checklistId}/revisions/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(
          typeof data.error === "string" ? data.error : "No se pudo eliminar la revisión."
        );
        setDeleteLoading(false);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("No se pudo eliminar la revisión.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
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
                const canDelete = canDeleteChecklistRevision(sessionRole, sessionId, rev);
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
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(rev);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Eliminar
                          </button>
                        ) : null}
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
      {deleteError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {deleteError}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleteTarget != null}
        title="Eliminar revisión"
        message={
          deleteTarget
            ? `¿Eliminar la revisión «${deleteTarget.name}» (#${deleteTarget.revisionNumber}) del historial? La plantilla publicada no cambia. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
        loading={deleteLoading}
      />
    </>
  );
}
