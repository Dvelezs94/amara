"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Asset = { id: string; name: string; assetId: string };
type User = { id: string; name: string };
type ChecklistTemplate = { id: string; name: string };

export function WorkOrderForm({
  workOrderId,
  canEditAssignee = true,
  initial = {},
}: {
  workOrderId?: string;
  canEditAssignee?: boolean;
  initial?: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assetId?: string;
    assigneeId?: string;
    dueDate?: string;
    checklistTemplateId?: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(Array.isArray(d) ? d : []))
      .catch(() => setAssets([]));
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
    fetch("/api/checklist-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    const priority = (form.elements.namedItem("priority") as HTMLSelectElement).value;
    const assetId = (form.elements.namedItem("assetId") as HTMLSelectElement).value || undefined;
    const assigneeId = canEditAssignee
      ? (form.elements.namedItem("assigneeId") as HTMLSelectElement | null)?.value ||
        undefined
      : undefined;
    const dueDate = (form.elements.namedItem("dueDate") as HTMLInputElement).value || undefined;
    const checklistTemplateId = (form.elements.namedItem("checklistTemplateId") as HTMLSelectElement)?.value || undefined;

    try {
      if (workOrderId) {
        const res = await fetch(`/api/work-orders/${workOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            priority,
            assetId: assetId || null,
            ...(canEditAssignee ? { assigneeId: assigneeId || null } : {}),
            dueDate: dueDate || null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Error al guardar");
          setLoading(false);
          return;
        }
        router.push(`/tareas/${workOrderId}`);
      } else {
        const res = await fetch("/api/work-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            priority,
            assetId: assetId || null,
            assigneeId: assigneeId || null,
            dueDate: dueDate || null,
            checklistTemplateId: checklistTemplateId || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Error al crear");
          setLoading(false);
          return;
        }
        router.push(`/tareas/${data.id}`);
      }
      router.refresh();
    } catch {
      setError("Algo salió mal");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700 mb-1">
          Título *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={initial.title}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial.description}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-zinc-700 mb-1">
          Prioridad
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue={initial.priority ?? "medium"}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
      <div>
        <label htmlFor="assetId" className="block text-sm font-medium text-zinc-700 mb-1">
          Activo
        </label>
        <select
          id="assetId"
          name="assetId"
          defaultValue={initial.assetId ?? ""}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Ninguno</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.assetId})
            </option>
          ))}
        </select>
      </div>
      {canEditAssignee && (
        <div>
          <label htmlFor="assigneeId" className="block text-sm font-medium text-zinc-700 mb-1">
            Asignado a
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={initial.assigneeId ?? ""}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium text-zinc-700 mb-1">
          Fecha de vencimiento
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={initial.dueDate?.slice(0, 10)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      {!workOrderId && templates.length > 0 && (
        <div>
          <label htmlFor="checklistTemplateId" className="block text-sm font-medium text-zinc-700 mb-1">
            Plantilla de checklist
          </label>
          <select
            id="checklistTemplateId"
            name="checklistTemplateId"
            defaultValue={initial.checklistTemplateId ?? ""}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Ninguna</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary-600 text-white py-3 px-4 font-medium tap-target disabled:opacity-60"
        >
          {loading ? "Guardando…" : workOrderId ? "Guardar" : "Crear"}
        </button>
        {workOrderId ? (
          <Link
            href={`/tareas/${workOrderId}`}
            className="rounded-xl border border-zinc-300 py-3 px-4 font-medium text-zinc-700 tap-target"
          >
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
