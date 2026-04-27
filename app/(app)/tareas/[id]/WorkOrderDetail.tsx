"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Check,
  Square,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Equal,
  X,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";
import {
  formatWorkOrderElapsedCompact,
  formatWorkOrderElapsedLabel,
  workOrderShouldShowElapsed,
} from "@/lib/work-order-duration";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

const priorityDetail: Record<
  string,
  { Icon: typeof Equal; className: string; label: string }
> = {
  low: { Icon: ChevronDown, className: "text-[#0065FF]", label: "Baja" },
  medium: { Icon: Equal, className: "text-[#E2A100]", label: "Media" },
  high: { Icon: ChevronUp, className: "text-[#FF8B00]", label: "Alta" },
  urgent: { Icon: ChevronsUp, className: "text-[#BF2600]", label: "Urgente" },
};

function formatDate(s: string | Date | null) {
  if (s == null) return "—";
  return new Date(s).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
}

type ChecklistItem = {
  id: string;
  type: string;
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
  options?: string[] | null | unknown;
};

/** Stored file paths from the app (work-order uploads live under `public/uploads/...`). */
function isWorkOrderStoredUploadPath(s: string): boolean {
  const p = s.trim();
  return p.startsWith("/uploads/");
}

/**
 * Adjuntos table + checklist photo fields (mobile uploads via `/attachments` and/or saves URL on checklist).
 */
function mergeAttachmentsWithChecklistPhotos(
  attachmentRows: { id: string; fileUrl: string; filename: string }[],
  checklistItems: ChecklistItem[]
): { id: string; fileUrl: string; filename: string }[] {
  const seen = new Set<string>();
  const out: { id: string; fileUrl: string; filename: string }[] = [];
  for (const a of attachmentRows) {
    const url = a.fileUrl.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ id: a.id, fileUrl: url, filename: a.filename });
  }
  for (const item of checklistItems) {
    if (item.fieldType !== "photo") continue;
    const v = item.value;
    if (typeof v !== "string" || !isWorkOrderStoredUploadPath(v)) continue;
    const url = v.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      id: `checklist-photo-${item.id}`,
      fileUrl: url,
      filename: item.label ? `${item.label} (checklist)` : "Evidencia checklist",
    });
  }
  return out;
}

export function WorkOrderDetail({
  initial,
  canEditAssignee = false,
}: {
  initial: {
    id: string;
    folio?: number | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    kind?: string | null;
    dueDate: string | Date | null;
    createdAt: string | Date;
    startedAt?: string | Date | null;
    completedAt: string | Date | null;
    asset: { id: string; name: string; assetId: string } | null;
    assignee: { id: string; name: string; avatarUrl?: string | null } | null;
    requester: { id: string; name: string; avatarUrl?: string | null } | null;
    checklist: ChecklistItem[];
    attachments: {
      id: string;
      fileUrl: string;
      filename: string;
      createdAt: string | Date;
    }[];
  };
  canEditAssignee?: boolean;
}) {
  const [checklist, setChecklist] = useState(initial.checklist);
  const [attachments, setAttachments] = useState(initial.attachments);
  const [assigneeId, setAssigneeId] = useState(initial.assignee?.id ?? "");
  const [assigneeUsers, setAssigneeUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );
  const woPhotoInputRef = useRef<HTMLInputElement>(null);
  const isCompleted = initial.status === "completed";
  const checklistUnlocked = initial.status === "in_progress";
  const kind = parseWorkOrderKind(initial.kind);
  const [durationTick, setDurationTick] = useState(0);

  const needsLiveDuration = initial.status === "in_progress";

  useEffect(() => {
    if (!needsLiveDuration) return;
    const id = window.setInterval(() => setDurationTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [needsLiveDuration]);

  useEffect(() => {
    if (!canEditAssignee) return;
    let cancelled = false;
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setAssigneeUsers(list.map((u) => ({ id: u.id, name: u.name })));
        }
      })
      .catch(() => {
        if (!cancelled) setAssigneeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canEditAssignee]);

  useEffect(() => {
    if (!imageLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setImageLightbox(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imageLightbox]);

  async function uploadWorkOrderPhoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/work-orders/${initial.id}/attachments`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Error al subir la foto");
    }
    return data as {
      id: string;
      fileUrl: string;
      filename: string;
      createdAt: string;
    };
  }

  async function onWorkOrderPhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const newItems: typeof attachments = [];
      for (let i = 0; i < files.length; i += 1) {
        const row = await uploadWorkOrderPhoto(files[i]);
        newItems.push({
          id: row.id,
          fileUrl: row.fileUrl,
          filename: row.filename,
          createdAt: row.createdAt,
        });
      }
      setAttachments((prev) => [...newItems, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onChecklistPhotoSelected(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!checklistUnlocked) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const row = await uploadWorkOrderPhoto(file);
      setAttachments((prev) => {
        if (prev.some((p) => p.fileUrl === row.fileUrl)) return prev;
        return [
          {
            id: row.id,
            fileUrl: row.fileUrl,
            filename: row.filename,
            createdAt: row.createdAt,
          },
          ...prev,
        ];
      });
      setChecklist((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, value: row.fileUrl } : i
        )
      );
      await fetch(`/api/work-orders/${initial.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, value: row.fileUrl }),
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function toggleStep(itemId: string, completed: boolean) {
    if (!checklistUnlocked) return;
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    await fetch(`/api/work-orders/${initial.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, completed }),
    });
  }

  async function updateFieldValue(itemId: string, value: unknown) {
    if (!checklistUnlocked) return;
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, value } : i))
    );
    await fetch(`/api/work-orders/${initial.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value }),
    });
  }

  async function updateStatus(status: string) {
    await fetch(`/api/work-orders/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  }

  async function updateAssignee(nextAssigneeId: string) {
    if (!canEditAssignee || isCompleted) return;
    const previous = assigneeId;
    setAssigneeId(nextAssigneeId);
    setAssigneeSaving(true);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: nextAssigneeId || null }),
      });
      if (!res.ok) {
        setAssigneeId(previous);
      }
    } catch {
      setAssigneeId(previous);
    } finally {
      setAssigneeSaving(false);
    }
  }

  const pr = priorityDetail[initial.priority] ?? {
    Icon: Equal,
    className: "text-zinc-400",
    label: initial.priority,
  };
  const PriIcon = pr.Icon;
  const assigneeDisplayName =
    assigneeId === ""
      ? null
      : assigneeUsers.find((u) => u.id === assigneeId)?.name ??
        (initial.assignee?.id === assigneeId ? initial.assignee.name : null);

  const statusLabel =
    initial.status === "pending"
      ? "Pendiente"
      : initial.status === "in_progress"
        ? "En curso"
        : initial.status === "completed"
          ? "Completada"
          : initial.status === "cancelled"
            ? "Cancelada"
            : initial.status.replace("_", " ");

  const adjuntosDisplay = useMemo(
    () => mergeAttachmentsWithChecklistPhotos(attachments, checklist),
    [attachments, checklist]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2 sm:gap-3">
          <nav
            className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
            aria-label="Migas de pan"
          >
            <Link
              href="/tareas"
              className="inline-flex items-center gap-1 font-medium text-[#F14C03] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tareas
            </Link>
            <span aria-hidden className="text-zinc-400">
              /
            </span>
            <span className="text-zinc-600">
              {initial.folio != null
                ? `Folio ${initial.folio}`
                : `Ref. ${initial.id.slice(0, 8)}…`}
            </span>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isCompleted && (
            <Link
              href={`/tareas/${initial.id}/edit`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 tap-target"
              aria-label="Editar tarea"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-[26px] md:leading-snug">
          {initial.title}
        </h1>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-0 flex-1 space-y-6">
          <details
            open
            className="group rounded-xl border border-zinc-200 bg-white [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Descripción</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-zinc-100 px-4 py-4 text-sm leading-relaxed text-zinc-800">
              {initial.description ? (
                <p className="whitespace-pre-wrap">{initial.description}</p>
              ) : (
                <p className="text-zinc-400">Sin descripción.</p>
              )}
            </div>
          </details>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Adjuntos</h2>
        <p className="mt-0.5 text-xs text-zinc-500 mb-2">
          Fotos y evidencias de la tarea
        </p>
        {uploadError && (
          <p className="mb-2 text-sm text-red-600">{uploadError}</p>
        )}
        {!isCompleted && (
          <div className="mb-3">
            <input
              ref={woPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onWorkOrderPhotosSelected}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => woPhotoInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 tap-target disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Subiendo…" : "Subir fotos"}
            </button>
            <p className="mt-1 text-xs text-zinc-500">
              Imagenes JPEG, PNG, WebP, etc.
            </p>
          </div>
        )}
        {adjuntosDisplay.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay fotos adjuntas.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {adjuntosDisplay.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setImageLightbox({ src: a.fileUrl, alt: a.filename })}
                  className="tap-target block aspect-square w-full bg-zinc-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label={`Ampliar: ${a.filename}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.fileUrl}
                    alt=""
                    className="pointer-events-none h-full w-full object-cover"
                  />
                </button>
                <p title={a.filename} className="truncate px-1 py-1 text-xs text-zinc-500">
                  {a.filename}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {checklist.length > 0 && (
        <section className="max-w-none rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Checklist</h2>
          {!checklistUnlocked && initial.status === "pending" && (
            <p className="mb-2 mt-1 text-xs text-amber-700">
              Cambia el estado a <strong>En curso</strong> en el panel derecho para
              editar el checklist.
            </p>
          )}
          <ul className="space-y-2">
            {checklist.map((item) =>
              item.type === "step" ? (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900"
                >
                  {!checklistUnlocked ? (
                    <span className="text-zinc-600">
                      {item.completed ? (
                        <Check className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        toggleStep(item.id, !(item.completed ?? false))
                      }
                      className="tap-target text-zinc-600"
                      aria-label={item.completed ? "Marcar incompleto" : "Marcar completo"}
                    >
                      {item.completed ? (
                        <Check className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  <span
                    className={
                      item.completed ? "text-zinc-500 line-through" : "text-zinc-900"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ) : (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-900"
                >
                  <label className="text-sm font-medium text-zinc-700">
                    {item.label}
                  </label>
                  {!checklistUnlocked ? (
                    <div className="text-zinc-900">
                      {item.fieldType === "checkbox"
                        ? item.value === true
                          ? "Sí"
                          : "No"
                        : item.fieldType === "photo" &&
                          typeof item.value === "string" &&
                          item.value.startsWith("/") ? (
                          <button
                            type="button"
                            onClick={() =>
                              setImageLightbox({
                                src: item.value as string,
                                alt: item.label || "Evidencia",
                              })
                            }
                            className="tap-target block max-w-xs rounded-lg border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            aria-label={`Ampliar evidencia: ${item.label}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.value}
                              alt=""
                              className="pointer-events-none max-h-48 rounded-lg border border-zinc-200"
                            />
                          </button>
                        ) : item.value != null ? (
                          String(item.value)
                        ) : (
                          "—"
                        )}
                    </div>
                  ) : (
                    <>
                      {item.fieldType === "checkbox" && (
                        <div className="self-start">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.value === true}
                              onChange={(e) => updateFieldValue(item.id, e.target.checked)}
                              className="h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 accent-primary-600"
                            />
                            <span className="text-sm text-zinc-700">Marcar si aplica</span>
                          </label>
                        </div>
                      )}
                      {item.fieldType === "text" && (
                        <input
                          type="text"
                          value={item.value != null ? String(item.value) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value)}
                          placeholder="Escribir valor"
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "number" && (
                        <input
                          type="number"
                          value={item.value != null ? Number(item.value) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value === "" ? null : Number(e.target.value))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "date" && (
                        <input
                          type="date"
                          value={item.value != null ? String(item.value).slice(0, 10) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value || null)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "dropdown" && (
                        <select
                          value={item.value != null ? String(item.value) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value || null)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="" className="bg-white text-zinc-900">
                            Seleccionar…
                          </option>
                          {(Array.isArray(item.options) ? item.options : []).map((opt: string) => (
                            <option key={opt} value={opt} className="bg-white text-zinc-900">
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {item.fieldType === "photo" && (
                        <div className="space-y-2">
                          {typeof item.value === "string" &&
                            item.value.startsWith("/") && (
                              <button
                                type="button"
                                onClick={() =>
                                  setImageLightbox({
                                    src: item.value as string,
                                    alt: item.label || "Previsualización",
                                  })
                                }
                                className="tap-target block max-w-xs rounded-lg border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                aria-label={`Ampliar: ${item.label}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.value}
                                  alt=""
                                  className="pointer-events-none max-h-40 rounded-lg border border-zinc-200"
                                />
                              </button>
                            )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploading}
                            onChange={(e) => onChecklistPhotoSelected(item.id, e)}
                            className="text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
                          />
                        </div>
                      )}
                      {item.fieldType !== "checkbox" && item.fieldType !== "text" && item.fieldType !== "number" && item.fieldType !== "date" && item.fieldType !== "dropdown" && item.fieldType !== "photo" && (
                        <p className="text-zinc-900">
                          {item.value != null ? String(item.value) : "—"}
                        </p>
                      )}
                    </>
                  )}
                </li>
              )
            )}
          </ul>
          {checklistUnlocked && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => updateStatus("completed")}
                className="rounded-lg bg-emerald-600 py-2 px-3 text-sm font-medium text-white tap-target hover:bg-emerald-700"
              >
                Completar tarea
              </button>
            </div>
          )}
        </section>
      )}

        </div>

        <aside className="order-first w-full shrink-0 space-y-4 lg:order-none lg:sticky lg:top-4 lg:w-72 xl:w-80">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="wo-status"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              Estado
            </label>
            {isCompleted || initial.status === "cancelled" ? (
              <div
                className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  statusColors[initial.status] ?? "bg-zinc-100 text-zinc-600"
                }`}
              >
                {statusLabel}
              </div>
            ) : (
              <select
                id="wo-status"
                value={initial.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="w-full cursor-pointer rounded-lg border-2 border-[#F14C03] bg-[#FFF5F0] py-2.5 pl-3 pr-8 text-sm font-semibold text-zinc-900 shadow-sm focus:border-[#F14C03] focus:outline-none focus:ring-2 focus:ring-[#F14C03]/25"
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="completed">Terminada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            )}
          </div>

          <details className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
              <span>Detalles</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-zinc-100 px-4">
              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Tipo</span>
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workOrderKindBadgeClass(
                      kind
                    )}`}
                  >
                    {workOrderKindLabel(kind)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Prioridad</span>
                <div className="flex min-w-0 items-center gap-2 font-medium text-zinc-900">
                  <PriIcon
                    className={`h-4 w-4 shrink-0 ${pr.className}`}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span>{pr.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Asignado</span>
                <div className="min-w-0">
                  {canEditAssignee ? (
                    <div className="space-y-2">
                      {assigneeId && assigneeDisplayName ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            userId={assigneeId}
                            name={assigneeDisplayName}
                            avatarUrl={
                              initial.assignee?.id === assigneeId
                                ? initial.assignee.avatarUrl
                                : null
                            }
                            size="sm"
                            className="!h-8 !w-8 !text-[10px]"
                          />
                          <span className="truncate text-sm font-medium text-zinc-900">
                            {assigneeDisplayName}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400">Sin asignar</p>
                      )}
                      <select
                        value={assigneeId}
                        disabled={isCompleted || assigneeSaving}
                        onChange={(e) => updateAssignee(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
                      >
                        <option value="">Sin asignar</option>
                        {assigneeUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : assigneeDisplayName ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        userId={assigneeId || initial.assignee?.id || ""}
                        name={assigneeDisplayName}
                        avatarUrl={initial.assignee?.avatarUrl}
                        size="sm"
                        className="!h-8 !w-8 !text-[10px]"
                      />
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {assigneeDisplayName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-400">Sin asignar</span>
                  )}
                </div>
              </div>

              {initial.requester ? (
                <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                  <span className="text-zinc-500">Solicitante</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      userId={initial.requester.id}
                      name={initial.requester.name}
                      avatarUrl={initial.requester.avatarUrl}
                      size="sm"
                      className="!h-8 !w-8 !text-[10px]"
                    />
                    <span className="truncate font-medium text-zinc-900">
                      {initial.requester.name}
                    </span>
                  </div>
                </div>
              ) : null}

              {initial.asset ? (
                <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                  <span className="text-zinc-500">Activo</span>
                  <div className="min-w-0">
                    <Link
                      href={`/assets/${initial.asset.id}`}
                      className="font-medium text-[#F14C03] hover:underline"
                    >
                      <span className="block truncate">
                        {initial.asset.name}
                      </span>
                      <span className="text-xs font-normal text-zinc-500">
                        {initial.asset.assetId}
                      </span>
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Vencimiento</span>
                <span className="font-medium text-zinc-900">
                  {formatDate(initial.dueDate)}
                </span>
              </div>

              {workOrderShouldShowElapsed(initial.status, initial.startedAt) ? (
                (() => {
                  void durationTick;
                  const nowMs = Date.now();
                  const compact = formatWorkOrderElapsedCompact(
                    initial.createdAt,
                    initial.status,
                    initial.completedAt,
                    nowMs
                  );
                  const verbose = formatWorkOrderElapsedLabel(
                    initial.createdAt,
                    initial.status,
                    initial.completedAt,
                    nowMs
                  );
                  const label =
                    initial.status === "completed"
                      ? "Tiempo total"
                      : "Tiempo transcurrido";
                  return (
                    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                        {label}
                      </span>
                      <div className="min-w-0 text-zinc-900">
                        <span
                          className="block tabular-nums tracking-tight"
                          title={verbose}
                        >
                          {compact}
                        </span>
                        {initial.status === "in_progress" ? (
                          <span className="mt-1 block text-xs text-zinc-400">
                            Desde el alta. Actualización cada minuto.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ) : null}

              {initial.status === "completed" && initial.completedAt ? (
                <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                  <span className="text-zinc-500">Completada</span>
                  <span className="font-medium text-zinc-900">
                    {formatDate(initial.completedAt)}
                  </span>
                </div>
              ) : null}
            </div>
          </details>
        </aside>
      </div>

      {imageLightbox ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/95"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
              {imageLightbox.alt}
            </p>
            <button
              type="button"
              onClick={() => setImageLightbox(null)}
              className="tap-target shrink-0 rounded-lg p-2 text-white hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0"
            onClick={() => setImageLightbox(null)}
            aria-label="Cerrar vista ampliada"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageLightbox.src}
              alt={imageLightbox.alt}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}
