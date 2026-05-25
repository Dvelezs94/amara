"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChecklistGroupedList } from "@/components/ChecklistGroupedList";
import {
  checklistItemDepth,
  flattenChecklistTreeForDisplay,
} from "@/lib/checklist-item-tree";

export type SerializableRevision = {
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
  id?: string;
  parentItemId?: string | null;
  sortOrder?: number;
  type?: string;
  label?: string;
  fieldType?: string | null;
  options?: string[] | null;
};

type SnapshotTreeItem = {
  id: string;
  parentItemId: string | null;
  sortOrder: number;
  type: string;
  label: string;
  fieldType: string | null;
  options: string[] | null;
};

function normalizeSnapshotItems(items: ItemSnapshot[]): SnapshotTreeItem[] {
  return items.map((it, index) => {
    const o = it as Record<string, unknown>;
    const id =
      typeof o.id === "string" && String(o.id).trim()
        ? String(o.id).trim()
        : `snap-${index}`;
    const parentItemId =
      typeof o.parentItemId === "string" && String(o.parentItemId).trim()
        ? String(o.parentItemId).trim()
        : null;
    const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : index;
    const type = typeof o.type === "string" ? o.type : "custom_field";
    const label = typeof o.label === "string" ? o.label : "";
    const fieldType =
      typeof o.fieldType === "string" || o.fieldType === null ? (o.fieldType as string | null) : null;
    const options = Array.isArray(o.options) ? (o.options as string[]) : null;
    return { id, parentItemId, sortOrder, type, label, fieldType, options };
  });
}

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

export function ChecklistRevisionInspect({
  revision,
  checklistId,
  canReview,
  showEditDraftLink,
}: {
  revision: SerializableRevision;
  checklistId: string;
  canReview: boolean;
  showEditDraftLink?: boolean;
}) {
  const router = useRouter();
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!rejectModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!reviewBusy) {
        setRejectModalOpen(false);
        setRejectReason("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rejectModalOpen, reviewBusy]);

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
      router.push(`/checklists/${checklistId}/revisions`);
      router.refresh();
    } finally {
      setReviewBusy(false);
    }
  }

  const snapshot = getAfterSnapshot(revision.metadata);
  const snapshotDisplay = useMemo(() => {
    if (!snapshot?.items.length) {
      return { treeRows: [] as SnapshotTreeItem[], flat: [] as SnapshotTreeItem[] };
    }
    const treeRows = normalizeSnapshotItems(snapshot.items);
    return { treeRows, flat: flattenChecklistTreeForDisplay(treeRows) };
  }, [snapshot]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Revisión #{revision.revisionNumber}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">Revisión {revision.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(revision.createdAt).toLocaleString("es-MX")} · {revision.userName ?? "Sistema"}
          </p>
          {revision.status === "rejected" && revision.reviewComment && (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              Motivo de rechazo: {revision.reviewComment}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showEditDraftLink && (
            <Link
              href={`/checklists/${checklistId}/revisions/${revision.id}/edit`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Editar borrador
            </Link>
          )}
          {canReview && revision.status === "proposed" && (
            <>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => decideRevision(revision.id, "approve")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Aprobar
              </button>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => {
                  setRejectModalOpen(true);
                  setRejectReason("");
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Rechazar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-6 text-sm">
        {Array.isArray((revision.metadata?.before as { items?: unknown } | undefined)?.items) ||
        Array.isArray((revision.metadata?.after as { items?: unknown } | undefined)?.items) ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cambios en elementos
            </h3>
            <ul className="space-y-2">
              {(() => {
                const beforeItems = getRevisionItems(revision.metadata, "before");
                const afterItems = getRevisionItems(revision.metadata, "after");
                const changes = getItemChanges(beforeItems, afterItems);
                if (changes.length === 0) {
                  return <li className="text-zinc-500">Sin cambios detectados en la lista.</li>;
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
                        {item?.type ?? "item"} {item?.fieldType ? `(${item.fieldType})` : ""}
                      </p>
                      {change.kind === "edited" && change.before && change.after && (
                        <p className="mt-1 text-xs text-zinc-700">
                          Antes: {change.before.label ?? "—"} | Después: {change.after.label ?? "—"}
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Otros cambios
            </h3>
            {(() => {
              const changes = getFieldChanges(revision.action, revision.metadata);
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
                            Antes: {formatValue(change.before)} | Después: {formatValue(change.after)}
                          </p>
                        ) : change.kind === "added" ? (
                          <p className="mt-1 text-xs text-zinc-700">Valor: {formatValue(change.after)}</p>
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

        {snapshot && (
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Resultado propuesto (vista previa)
            </p>
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-medium text-zinc-500">Nombre</p>
              <p className="mt-1 text-zinc-900">{snapshot.name}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-medium text-zinc-500">Descripción</p>
              <p className="mt-1 text-zinc-900">{snapshot.description || "Sin descripción"}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-medium text-zinc-500">Elementos</p>
              <ChecklistGroupedList
                flat={snapshotDisplay.flat}
                all={snapshotDisplay.treeRows}
                className="mt-3 space-y-5"
                collapseContextKey={`revision-${revision.id}`}
                renderItem={(item, { insideSection }) => {
                  const depth = checklistItemDepth(item, snapshotDisplay.treeRows);
                  const padStyle = { paddingLeft: Math.min(depth, 8) * 16 };
                  const rowPad = insideSection ? "px-4 py-3" : "py-3";
                  return (
                    <li key={item.id} style={padStyle} className={rowPad}>
                      {item.type === "text_block" ? (
                        <div>
                          {item.fieldType === "title" ? (
                            <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                          ) : item.fieldType === "subtitle" ? (
                            <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                          ) : (
                            <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                          )}
                        </div>
                      ) : item.type === "step" ? (
                        <div className="flex items-center gap-2 text-zinc-900">
                          <input
                            type="checkbox"
                            disabled
                            checked={false}
                            className="h-4 w-4 rounded border-zinc-300 text-primary-600 accent-primary-600"
                          />
                          <span>{item.label}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 text-zinc-900">
                          <label className="text-sm font-medium text-zinc-700">{item.label}</label>
                          {item.fieldType === "checkbox" ? (
                            <div className="self-start">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 accent-primary-600"
                                />
                                <span className="text-sm text-zinc-500">Marcar si aplica</span>
                              </label>
                            </div>
                          ) : item.fieldType === "dropdown" ? (
                            <select
                              disabled
                              value=""
                              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                            >
                              <option value="">Seleccionar…</option>
                              {(item.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              disabled
                              value=""
                              placeholder="Campo vacío"
                              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm"
                              onChange={() => undefined}
                            />
                          )}
                        </div>
                      )}
                    </li>
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>

      {rejectModalOpen && typeof window !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[320] flex items-center justify-center bg-zinc-950/60 p-4"
              onClick={() => {
                if (!reviewBusy) {
                  setRejectModalOpen(false);
                  setRejectReason("");
                }
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold text-zinc-900">Rechazar revisión</h3>
                <p className="mt-1 text-sm text-zinc-600">Revisión {revision.name}</p>
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
                      setRejectModalOpen(false);
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
                      await decideRevision(revision.id, "reject", rejectReason.trim());
                      setRejectModalOpen(false);
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
