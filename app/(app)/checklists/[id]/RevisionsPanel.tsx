"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Eye } from "lucide-react";
import { PrintChecklistButton } from "./PrintChecklistButton";

type Revision = {
  id: string;
  action: string;
  name: string;
  revisionNumber: number;
  status: string;
  createdAt: string;
  userName: string | null;
  reviewComment: string | null;
  metadata: Record<string, unknown> | null;
};

type ItemSnapshot = {
  type?: string;
  label?: string;
  fieldType?: string | null;
  options?: string[] | null;
};

type ItemChange = {
  kind: "added" | "removed" | "edited";
  before?: ItemSnapshot;
  after?: ItemSnapshot;
  index: number;
};

type FieldChange = {
  kind: "added" | "removed" | "edited";
  field: string;
  before?: unknown;
  after?: unknown;
};

type RevisionSnapshot = {
  name: string;
  description: string | null;
  items: ItemSnapshot[];
};

function summarizeRevisionChange(
  action: string,
  metadata: Record<string, unknown> | null
) {
  if (!metadata) return null;
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  if (Array.isArray(before?.items) || Array.isArray(after?.items)) {
    const beforeItems = Array.isArray(before?.items) ? before.items : [];
    const afterItems = Array.isArray(after?.items) ? after.items : [];
    const added = Math.max(afterItems.length - beforeItems.length, 0);
    const removed = Math.max(beforeItems.length - afterItems.length, 0);
    return `Cambios +${added} / -${removed}`;
  }

  if (action === "updated") {
    if (!before || !after) return null;
    const changed: string[] = [];
    if (after.name !== undefined && after.name !== before.name) changed.push("nombre");
    if (after.description !== undefined && after.description !== before.description) {
      changed.push("descripción");
    }
    return changed.length > 0 ? `Cambios: ${changed.join(", ")}` : "Plantilla actualizada";
  }

  if (action === "items_updated") {
    const before = Array.isArray(metadata.before) ? metadata.before : [];
    const after = Array.isArray(metadata.after) ? metadata.after : [];
    const added = Math.max(after.length - before.length, 0);
    const removed = Math.max(before.length - after.length, 0);
    return `Cambios +${added} / -${removed}`;
  }

  if (action === "created") return "Plantilla creada";
  if (action === "deleted") return "Plantilla eliminada";
  return null;
}

function getItems(metadata: Record<string, unknown> | null, key: "before" | "after") {
  const value = metadata?.[key];
  return Array.isArray(value) ? (value as ItemSnapshot[]) : [];
}

function getRevisionItems(
  metadata: Record<string, unknown> | null,
  key: "before" | "after"
) {
  const parent = metadata?.[key];
  if (!parent || typeof parent !== "object") return [];
  const value = (parent as Record<string, unknown>).items;
  return Array.isArray(value) ? (value as ItemSnapshot[]) : [];
}

function itemFingerprint(item?: ItemSnapshot) {
  if (!item) return "";
  return JSON.stringify({
    type: item.type ?? null,
    label: item.label ?? null,
    fieldType: item.fieldType ?? null,
    options: item.options ?? null,
  });
}

function getItemChanges(
  beforeItems: ItemSnapshot[],
  afterItems: ItemSnapshot[]
): ItemChange[] {
  const max = Math.max(beforeItems.length, afterItems.length);
  const changes: ItemChange[] = [];
  for (let i = 0; i < max; i += 1) {
    const before = beforeItems[i];
    const after = afterItems[i];
    if (!before && after) {
      changes.push({ kind: "added", after, index: i });
      continue;
    }
    if (before && !after) {
      changes.push({ kind: "removed", before, index: i });
      continue;
    }
    if (before && after && itemFingerprint(before) !== itemFingerprint(after)) {
      changes.push({ kind: "edited", before, after, index: i });
    }
  }
  return changes;
}

function formatFieldLabel(field: string) {
  if (field === "name") return "Nombre";
  if (field === "description") return "Descripción";
  return field;
}

function formatValue(value: unknown) {
  if (value == null) return "Sin valor";
  if (typeof value === "string") return value || "Sin valor";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function getFieldChanges(
  action: string,
  metadata: Record<string, unknown> | null
): FieldChange[] {
  if (!metadata) return [];
  const before = (metadata.before ?? {}) as Record<string, unknown>;
  const after = (metadata.after ?? {}) as Record<string, unknown>;

  if (action === "updated") {
    return Object.keys(after)
      .filter((key) => key !== "items")
      .filter((key) => before[key] !== after[key])
      .map((key) => ({
        kind: "edited" as const,
        field: key,
        before: before[key],
        after: after[key],
      }));
  }

  if (action === "created") {
    return Object.keys(metadata).map((key) => ({
      kind: "added" as const,
      field: key,
      after: metadata[key],
    }));
  }

  if (action === "deleted") {
    return Object.keys(metadata).map((key) => ({
      kind: "removed" as const,
      field: key,
      before: metadata[key],
    }));
  }

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((key) => key !== "items")
    .reduce<FieldChange[]>((changes, key) => {
      const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (hasBefore && hasAfter && before[key] !== after[key]) {
        changes.push({
          kind: "edited",
          field: key,
          before: before[key],
          after: after[key],
        });
      } else if (!hasBefore && hasAfter) {
        changes.push({ kind: "added", field: key, after: after[key] });
      } else if (hasBefore && !hasAfter) {
        changes.push({ kind: "removed", field: key, before: before[key] });
      }
      return changes;
    }, []);
}

function getAfterSnapshot(metadata: Record<string, unknown> | null): RevisionSnapshot | null {
  if (!metadata) return null;
  const after = metadata.after;
  if (!after || typeof after !== "object") return null;
  const afterObj = after as Record<string, unknown>;
  return {
    name: typeof afterObj.name === "string" ? afterObj.name : "Sin nombre",
    description:
      typeof afterObj.description === "string" || afterObj.description === null
        ? (afterObj.description as string | null)
        : null,
    items: Array.isArray(afterObj.items) ? (afterObj.items as ItemSnapshot[]) : [],
  };
}

export function RevisionsPanel({
  revisions,
  checklistId,
  mode,
  canReview,
}: {
  revisions: Revision[];
  checklistId: string;
  mode: "view" | "edit";
  canReview: boolean;
}) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectModalRevision, setRejectModalRevision] = useState<Revision | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const selectedRevision = useMemo(
    () => revisions.find((r) => r.id === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId]
  );

  useEffect(() => {
    if (!selectedRevision && !rejectModalRevision) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (rejectModalRevision) {
        if (!reviewBusy) {
          setRejectModalRevision(null);
          setRejectReason("");
        }
        return;
      }
      setSelectedRevisionId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRevision, rejectModalRevision, reviewBusy]);

  async function decideRevision(
    revisionId: string,
    decision: "approve" | "reject",
    comment?: string
  ) {
    if (!canReview) return;
    setReviewBusy(true);
    try {
      const res = await fetch(
        `/api/checklist-templates/${checklistId}/revisions/${revisionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comment: comment?.trim() || null }),
        }
      );
      if (!res.ok) return;
      window.location.reload();
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <>
      <aside className="rounded-xl border border-zinc-300 bg-white p-0 shadow-sm lg:h-full lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
        <div className="overflow-y-auto px-4 pb-4 pt-3 lg:h-full lg:px-4 lg:pb-4 lg:pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {mode === "view" && <PrintChecklistButton targetId="checklist-visualization" />}
            <div className="ml-auto inline-flex rounded-lg border border-zinc-200 bg-white p-1">
              <Link
                href={`/checklists/${checklistId}?mode=view`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "view"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                Visualizar
              </Link>
              <Link
                href={`/checklists/${checklistId}?mode=edit`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === "edit"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                Editar
              </Link>
            </div>
          </div>
          <h2 className="text-sm font-semibold text-zinc-900">Revisiones</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Historial reciente de cambios de la plantilla.
          </p>
          <ul className="mt-3 space-y-3">
          {revisions.length === 0 ? (
            <li className="text-sm text-zinc-500">Aún no hay revisiones.</li>
          ) : (
            revisions.map((rev) => (
              <li key={rev.id} className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium text-zinc-900">Revision {rev.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(rev.createdAt).toLocaleString("es-MX")}{" "}
                  {rev.userName ? `· ${rev.userName}` : "· Sistema"}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    rev.status === "approved"
                      ? "text-emerald-700"
                      : rev.status === "rejected"
                        ? "text-red-700"
                        : "text-amber-700"
                  }`}
                >
                  Estado:{" "}
                  {rev.status === "approved"
                    ? "Aprobada"
                    : rev.status === "rejected"
                      ? "Rechazada"
                      : "Propuesta"}
                </p>
                {summarizeRevisionChange(rev.action, rev.metadata) && (
                  <p className="mt-1 text-xs text-zinc-700">
                    {summarizeRevisionChange(rev.action, rev.metadata)}
                  </p>
                )}
                {mode === "view" && (
                  <button
                    type="button"
                    onClick={() => setSelectedRevisionId(rev.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Ver revisión
                  </button>
                )}
                {canReview && rev.status === "proposed" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={reviewBusy}
                      onClick={() => decideRevision(rev.id, "approve")}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={reviewBusy}
                      onClick={() => {
                        setRejectModalRevision(rev);
                        setRejectReason("");
                      }}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
                {rev.status === "rejected" && rev.reviewComment && (
                  <p className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                    Motivo: {rev.reviewComment}
                  </p>
                )}
              </li>
            ))
          )}
          </ul>
        </div>
      </aside>

      {selectedRevision && typeof window !== "undefined"
        ? createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-zinc-950/60 p-4"
          onClick={() => setSelectedRevisionId(null)}
        >
          <div
            className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Revision {selectedRevision.name}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(selectedRevision.createdAt).toLocaleString("es-MX")} ·{" "}
                  {selectedRevision.userName ?? "Sistema"}
                </p>
                {selectedRevision.status === "rejected" && selectedRevision.reviewComment && (
                  <p className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                    Motivo de rechazo: {selectedRevision.reviewComment}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedRevisionId(null)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm">
              {Array.isArray((selectedRevision.metadata?.before as { items?: unknown } | undefined)?.items) ||
              Array.isArray((selectedRevision.metadata?.after as { items?: unknown } | undefined)?.items) ? (
                <div>
                  <ul className="space-y-2">
                    {(() => {
                      const beforeItems = getRevisionItems(selectedRevision.metadata, "before");
                      const afterItems = getRevisionItems(selectedRevision.metadata, "after");
                      const changes = getItemChanges(beforeItems, afterItems);
                      if (changes.length === 0) {
                        return <li className="text-zinc-500">Sin cambios detectados.</li>;
                      }
                      return changes.map((change) => {
                        const item = change.after ?? change.before;
                        const tone =
                          change.kind === "added"
                            ? "border-emerald-300 bg-emerald-50"
                            : change.kind === "removed"
                              ? "border-red-300 bg-red-50"
                              : "border-amber-300 bg-amber-50";
                        const title =
                          change.kind === "added"
                            ? "Añadido"
                            : change.kind === "removed"
                              ? "Eliminado"
                              : "Editado";
                        return (
                          <li
                            key={`${change.kind}-${change.index}`}
                            className={`rounded-lg border p-2 ${tone}`}
                          >
                            <p className="text-sm font-semibold text-zinc-900">
                              {title}: {item?.label ?? "Sin etiqueta"}
                            </p>
                            <p className="text-xs text-zinc-600">
                              {item?.type ?? "item"}{" "}
                              {item?.fieldType ? `(${item.fieldType})` : ""}
                            </p>
                            {change.kind === "edited" && change.before && change.after && (
                              <p className="mt-1 text-xs text-zinc-700">
                                Antes: {change.before.label ?? "—"} | Después:{" "}
                                {change.after.label ?? "—"}
                              </p>
                            )}
                          </li>
                        );
                      });
                    })()}
                  </ul>
                </div>
              ) : (
                <div>
                  {(() => {
                    const changes = getFieldChanges(
                      selectedRevision.action,
                      selectedRevision.metadata
                    );
                    if (changes.length === 0) {
                      return (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-600">
                          Sin cambios detectados.
                        </div>
                      );
                    }
                    return (
                      <ul className="space-y-2">
                        {changes.map((change) => {
                          const tone =
                            change.kind === "added"
                              ? "border-emerald-300 bg-emerald-50"
                              : change.kind === "removed"
                                ? "border-red-300 bg-red-50"
                                : "border-amber-300 bg-amber-50";
                          const title =
                            change.kind === "added"
                              ? "Añadido"
                              : change.kind === "removed"
                                ? "Eliminado"
                                : "Editado";
                          return (
                            <li
                              key={`${change.kind}-${change.field}`}
                              className={`rounded-lg border p-2 ${tone}`}
                            >
                              <p className="text-sm font-semibold text-zinc-900">
                                {title}: {formatFieldLabel(change.field)}
                              </p>
                              {change.kind === "edited" ? (
                                <p className="mt-1 text-xs text-zinc-700">
                                  Antes: {formatValue(change.before)} | Después:{" "}
                                  {formatValue(change.after)}
                                </p>
                              ) : change.kind === "added" ? (
                                <p className="mt-1 text-xs text-zinc-700">
                                  Valor: {formatValue(change.after)}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-zinc-700">
                                  Valor anterior: {formatValue(change.before)}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              )}

              {mode === "view" && (() => {
                const snapshot = getAfterSnapshot(selectedRevision.metadata);
                if (!snapshot) return null;
                return (
                  <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Vista de la revisión
                    </p>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium text-zinc-500">Nombre</p>
                      <p className="mt-1 text-zinc-900">{snapshot.name}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium text-zinc-500">Descripción</p>
                      <p className="mt-1 text-zinc-900">
                        {snapshot.description || "Sin descripción"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium text-zinc-500">Elementos</p>
                      <ul className="mt-2 space-y-2">
                        {snapshot.items.map((item, idx) => (
                          <li key={`${item.label ?? "item"}-${idx}`}>
                            {item.type === "text_block" ? (
                              <div className="px-1 py-1">
                                {item.fieldType === "title" ? (
                                  <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                                ) : item.fieldType === "subtitle" ? (
                                  <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                                ) : (
                                  <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                                )}
                              </div>
                            ) : item.type === "step" ? (
                              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="h-4 w-4 rounded border-zinc-300 text-primary-600 accent-primary-600"
                                />
                                <span className="text-zinc-900">{item.label}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900">
                                <label className="text-sm font-medium text-zinc-700">{item.label}</label>
                                <input
                                  disabled
                                  value=""
                                  placeholder="Campo vacío"
                                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500"
                                  onChange={() => undefined}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )
        : null}

      {rejectModalRevision && typeof window !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[320] flex items-center justify-center bg-zinc-950/60 p-4"
              onClick={() => {
                if (!reviewBusy) {
                  setRejectModalRevision(null);
                  setRejectReason("");
                }
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold text-zinc-900">Rechazar revisión</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Revision {rejectModalRevision.name}
                </p>
                <label className="mt-3 block text-sm font-medium text-zinc-700">
                  Motivo del rechazo *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder="Explica por qué se rechaza esta revisión"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => {
                      setRejectModalRevision(null);
                      setRejectReason("");
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusy || rejectReason.trim().length < 3}
                    onClick={async () => {
                      await decideRevision(
                        rejectModalRevision.id,
                        "reject",
                        rejectReason.trim()
                      );
                    }}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {reviewBusy ? "Rechazando..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
