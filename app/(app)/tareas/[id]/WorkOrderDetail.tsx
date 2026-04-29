"use client";

import { useState, useRef, useEffect } from "react";
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
  FileText,
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

type WorkOrderComment = {
  id: string;
  body: string;
  createdAt: string | Date;
  user:
    | {
        id: string;
        name: string;
        avatarUrl?: string | null;
        avatarBackgroundColor?: string | null;
      }
    | null;
};

function isImageAttachment(filename: string, fileUrl: string): boolean {
  const raw = `${filename} ${fileUrl}`.toLowerCase();
  return (
    raw.includes(".jpg") ||
    raw.includes(".jpeg") ||
    raw.includes(".png") ||
    raw.includes(".gif") ||
    raw.includes(".webp") ||
    raw.includes(".bmp") ||
    raw.includes(".svg") ||
    raw.includes(".avif")
  );
}

function isLikelyInternalDownloadUrl(url: string): boolean {
  return url.startsWith("/api/work-orders/");
}

const COMMENT_ATTACHMENT_REGEX = /\[\[file:([^|\]]+)\|([^\]]+)\]\]/g;

function parseCommentBody(body: string): {
  text: string;
  attachments: { filename: string; fileUrl: string }[];
} {
  const attachments: { filename: string; fileUrl: string }[] = [];
  const text = body.replace(COMMENT_ATTACHMENT_REGEX, (_full, encodedName: string, fileUrl: string) => {
    const filename = decodeURIComponent(encodedName);
    attachments.push({ filename, fileUrl });
    return "";
  });
  return { text: text.trim(), attachments };
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
    checklistMeta: {
      templateName: string;
      revisionName: string | null;
      revisionNumber: number | null;
    } | null;
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
  const [assigneeId, setAssigneeId] = useState(initial.assignee?.id ?? "");
  const [assigneeUsers, setAssigneeUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );
  const commentFilesInputRef = useRef<HTMLInputElement>(null);
  const isCompleted = initial.status === "completed";
  const checklistUnlocked = initial.status === "in_progress";
  const kind = parseWorkOrderKind(initial.kind);
  const [durationTick, setDurationTick] = useState(0);
  const [comments, setComments] = useState<WorkOrderComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const res = await fetch(`/api/work-orders/${initial.id}/notes`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(
            (data as { error?: string })?.error ?? "No se pudieron cargar los comentarios."
          );
        }
        if (!cancelled) {
          setComments(Array.isArray(data) ? (data as WorkOrderComment[]) : []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommentsError(
            error instanceof Error ? error.message : "No se pudieron cargar los comentarios."
          );
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    }
    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [initial.id]);

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

  async function onChecklistPhotoSelected(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!checklistUnlocked) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const row = await uploadWorkOrderPhoto(file);
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

  async function submitComment() {
    const body = commentDraft.trim();
    if ((!body && commentFiles.length === 0) || commentSaving) return;
    setCommentSaving(true);
    setCommentsError(null);
    try {
      const formData = new FormData();
      formData.append("body", body);
      for (const file of commentFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/work-orders/${initial.id}/notes`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? "No se pudo guardar el comentario."
        );
      }
      setCommentDraft("");
      setCommentFiles([]);
      if (commentFilesInputRef.current) commentFilesInputRef.current.value = "";
      setComments((prev) => [data as WorkOrderComment, ...prev]);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "No se pudo guardar el comentario.");
    } finally {
      setCommentSaving(false);
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

      {checklist.length > 0 && (
        <section className="max-w-none rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Checklist
            {initial.checklistMeta ? ` · ${initial.checklistMeta.templateName}` : ""}
            {initial.checklistMeta?.revisionName
              ? ` · Revisión ${initial.checklistMeta.revisionName}`
              : initial.checklistMeta?.revisionNumber != null
                ? ` · Revisión ${initial.checklistMeta.revisionNumber}`
                : ""}
          </h2>
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
              ) : item.type === "text_block" ? (
                <li
                  key={item.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900"
                >
                  {item.fieldType === "title" ? (
                    <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                  ) : item.fieldType === "subtitle" ? (
                    <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                  ) : (
                    <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                  )}
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

          <section className="rounded-xl border border-zinc-200 bg-white p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">Actividad y evidencias</h2>
            </div>
            <div className="space-y-1.5">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={commentFilesInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      setCommentFiles(Array.from(files));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => commentFilesInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 tap-target"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Adjuntar
                  </button>
                  {commentFiles.length > 0 ? (
                    <span className="text-xs text-zinc-500">
                      {commentFiles.length} archivo(s) seleccionado(s)
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  disabled={commentSaving || (commentDraft.trim().length === 0 && commentFiles.length === 0)}
                  className="rounded-lg bg-[#F14C03] px-2.5 py-1.5 text-xs font-medium text-white tap-target hover:bg-[#D84402] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {commentSaving ? "Enviando..." : "Comentar"}
                </button>
              </div>
            </div>
            {commentsError ? <p className="mt-2 text-xs text-red-600">{commentsError}</p> : null}
            <div className="mt-2 max-h-72 overflow-y-auto pr-1">
              {commentsLoading ? (
                <p className="text-xs text-zinc-500">Cargando comentarios...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-zinc-500">Aún no hay comentarios.</p>
              ) : (
                <ul className="space-y-1.5">
                  {comments.map((comment) => {
                    const parsed = parseCommentBody(comment.body);
                    return (
                      <li key={comment.id} className="rounded-lg border border-zinc-200 p-2">
                        <div className="flex items-start gap-2">
                          <UserAvatar
                            userId={comment.user?.id ?? comment.id}
                            name={comment.user?.name ?? "Usuario"}
                            avatarUrl={comment.user?.avatarUrl ?? null}
                            size="sm"
                            className="!h-7 !w-7 !text-[9px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-zinc-500">
                              <span className="font-medium text-zinc-800">
                                {comment.user?.name ?? "Usuario"}
                              </span>
                              <span>•</span>
                              <span>{formatDate(comment.createdAt)}</span>
                            </div>
                            {parsed.text ? (
                              <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-800">
                                {parsed.text}
                              </p>
                            ) : null}
                            {parsed.attachments.length > 0 ? (
                              <ul className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {parsed.attachments.map((attachment) => (
                                  <li
                                    key={`${comment.id}-${attachment.fileUrl}`}
                                    className="overflow-hidden rounded-md border border-zinc-200"
                                  >
                                    <a
                                      href={attachment.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="tap-target flex aspect-square w-full flex-col items-center justify-center gap-1 bg-zinc-50 px-2 text-zinc-600 hover:bg-zinc-100"
                                    >
                                      <FileText className="h-5 w-5 text-zinc-500" aria-hidden />
                                      <span className="line-clamp-2 text-center text-[10px] font-medium">
                                        {isImageAttachment(attachment.filename, attachment.fileUrl) &&
                                        !isLikelyInternalDownloadUrl(attachment.fileUrl)
                                          ? "Imagen"
                                          : "Archivo"}
                                      </span>
                                    </a>
                                    <p
                                      title={attachment.filename}
                                      className="truncate px-1 py-0.5 text-[10px] text-zinc-500"
                                    >
                                      {attachment.filename}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

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
