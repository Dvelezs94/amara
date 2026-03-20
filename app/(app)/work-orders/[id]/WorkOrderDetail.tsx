"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Check, Square, ImagePlus } from "lucide-react";

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

function formatDate(s: string | Date | null) {
  if (s == null) return "—";
  return new Date(s).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
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

export function WorkOrderDetail({
  initial,
}: {
  initial: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | Date | null;
    completedAt: string | Date | null;
    asset: { id: string; name: string; assetId: string } | null;
    assignee: { id: string; name: string } | null;
    requester: { id: string; name: string } | null;
    checklist: ChecklistItem[];
    notes: { id: string; body: string; createdAt: string | Date }[];
    attachments: {
      id: string;
      fileUrl: string;
      filename: string;
      createdAt: string | Date;
    }[];
  };
}) {
  const [checklist, setChecklist] = useState(initial.checklist);
  const [attachments, setAttachments] = useState(initial.attachments);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const woPhotoInputRef = useRef<HTMLInputElement>(null);
  const isCompleted = initial.status === "completed";
  const checklistUnlocked = initial.status === "in_progress";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{initial.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
              statusColors[initial.status] ?? "bg-zinc-100 text-zinc-600"
            }`}
          >
            {initial.status === "open" ? "Abierta" : initial.status === "in_progress" ? "En curso" : initial.status === "completed" ? "Completada" : initial.status === "cancelled" ? "Cancelada" : initial.status.replace("_", " ")}
          </span>
          <span className="text-zinc-500">{initial.priority === "low" ? "Baja" : initial.priority === "medium" ? "Media" : initial.priority === "high" ? "Alta" : initial.priority === "urgent" ? "Urgente" : initial.priority}</span>
        </div>
      </div>

      {initial.description && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-1">Descripción</h2>
          <p className="text-zinc-900 whitespace-pre-wrap">{initial.description}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-zinc-500 mb-2">Fotos de la orden</h2>
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
        {attachments.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay fotos adjuntas.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attachments.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-zinc-200">
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square bg-zinc-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.fileUrl}
                    alt={a.filename}
                    className="h-full w-full object-cover"
                  />
                </a>
                <p title={a.filename} className="truncate px-1 py-1 text-xs text-zinc-500">
                  {a.filename}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 text-sm">
        {initial.asset && (
          <div>
            <p className="text-zinc-500">Activo</p>
            <Link
              href={`/assets/${initial.asset.id}`}
              className="text-primary-600 font-medium"
            >
              {initial.asset.name} ({initial.asset.assetId})
            </Link>
          </div>
        )}
        {initial.assignee && (
          <div>
            <p className="text-zinc-500">Asignado a</p>
            <p className="font-medium text-zinc-900">{initial.assignee.name}</p>
          </div>
        )}
        <div>
          <p className="text-zinc-500">Fecha de vencimiento</p>
          <p className="font-medium text-zinc-900">
            {formatDate(initial.dueDate)}
          </p>
        </div>
        {initial.requester && (
          <div>
            <p className="text-zinc-500">Solicitante</p>
            <p className="font-medium text-zinc-900">{initial.requester.name}</p>
          </div>
        )}
      </section>

      {initial.status !== "cancelled" && initial.status !== "completed" && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Acciones</h2>
          <div className="flex gap-2">
            {initial.status === "open" && (
              <button
                type="button"
                onClick={() => updateStatus("in_progress")}
                className="rounded-lg bg-primary-600 text-white py-2 px-3 text-sm font-medium"
              >
                Iniciar
              </button>
            )}
            {initial.status === "in_progress" && (
              <button
                type="button"
                onClick={() => updateStatus("completed")}
                className="rounded-lg bg-emerald-600 text-white py-2 px-3 text-sm font-medium"
              >
                Completar
              </button>
            )}
          </div>
        </section>
      )}

      {checklist.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Checklist</h2>
          {!checklistUnlocked && initial.status === "open" && (
            <p className="mb-2 text-xs text-amber-700">
              Haz clic en <strong>Iniciar</strong> para comenzar y editar el checklist.
            </p>
          )}
          <ul className="space-y-2">
            {checklist.map((item) =>
              item.type === "step" ? (
                <li key={item.id} className="flex items-center gap-2">
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
                      item.completed ? "text-zinc-500 line-through" : ""
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ) : (
                <li key={item.id} className="flex flex-col gap-1">
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
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-xs"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.value}
                              alt="Evidencia"
                              className="max-h-48 rounded-lg border border-zinc-200"
                            />
                          </a>
                        ) : item.value != null ? (
                          String(item.value)
                        ) : (
                          "—"
                        )}
                    </div>
                  ) : (
                    <>
                      {item.fieldType === "checkbox" && (
                        <input
                          type="checkbox"
                          checked={item.value === true}
                          onChange={(e) => updateFieldValue(item.id, e.target.checked)}
                          className="rounded border-zinc-300 text-primary-600"
                        />
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
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Seleccionar…</option>
                          {(Array.isArray(item.options) ? item.options : []).map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {item.fieldType === "photo" && (
                        <div className="space-y-2">
                          {typeof item.value === "string" &&
                            item.value.startsWith("/") && (
                              <a
                                href={item.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-xs"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.value}
                                  alt="Previsualización"
                                  className="max-h-40 rounded-lg border border-zinc-200"
                                />
                              </a>
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
        </section>
      )}

      {initial.notes.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Notas</h2>
          <ul className="space-y-2">
            {initial.notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-900"
              >
                {n.body}
                <p className="mt-1 text-xs text-zinc-400">
                  {formatDate(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
