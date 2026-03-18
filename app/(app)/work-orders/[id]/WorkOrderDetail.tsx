"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Square } from "lucide-react";

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
  };
}) {
  const [checklist, setChecklist] = useState(initial.checklist);
  const isCompleted = initial.status === "completed";

  async function toggleStep(itemId: string, completed: boolean) {
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
          <ul className="space-y-2">
            {checklist.map((item) =>
              item.type === "step" ? (
                <li key={item.id} className="flex items-center gap-2">
                  {isCompleted ? (
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
                  {isCompleted ? (
                    <p className="text-zinc-900">
                      {item.fieldType === "checkbox"
                        ? item.value === true
                          ? "Sí"
                          : "No"
                        : item.value != null
                          ? String(item.value)
                          : "—"}
                    </p>
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
                        <p className="text-zinc-500 text-sm">
                          {item.value != null ? "Foto adjunta" : "Subir foto (próximamente)"}
                        </p>
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
