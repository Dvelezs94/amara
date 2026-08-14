"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { MAX_MANUAL_DOWNTIME_MINUTES } from "@/lib/machine-downtime";

type Asset = { id: string; name: string; assetId: string; tracksMachineDowntime?: boolean };
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
    assigneeIds?: string[];
    dueDate?: string;
    startDate?: string;
    checklistTemplateId?: string;
    countsMachineDowntime?: boolean;
    manualDowntimeMinutes?: number;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial.assigneeIds ?? []);
  const [selectedAssetId, setSelectedAssetId] = useState(initial.assetId ?? "");
  const [downtimeChecked, setDowntimeChecked] = useState(
    () => initial.countsMachineDowntime === true
  );

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

  useEffect(() => {
    setAssigneeIds(initial.assigneeIds ?? []);
  }, [workOrderId, initial.assigneeIds?.join(",")]);

  useEffect(() => {
    setSelectedAssetId(initial.assetId ?? "");
  }, [workOrderId, initial.assetId]);

  useEffect(() => {
    setDowntimeChecked(initial.countsMachineDowntime === true);
  }, [workOrderId, initial.countsMachineDowntime]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId),
    [assets, selectedAssetId]
  );
  const machineAllowsDowntime =
    !selectedAssetId || selectedAsset?.tracksMachineDowntime !== false;
  const downtimeUiEnabled = Boolean(selectedAssetId) && machineAllowsDowntime;

  useEffect(() => {
    if (!downtimeUiEnabled) setDowntimeChecked(false);
  }, [downtimeUiEnabled]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    const priority = (form.elements.namedItem("priority") as HTMLSelectElement).value;
    const assetId = selectedAssetId || undefined;
    const countsMachineDowntime = downtimeUiEnabled && downtimeChecked;
    const dueDate = (form.elements.namedItem("dueDate") as HTMLInputElement).value || undefined;
    const startDate =
      (form.elements.namedItem("startDate") as HTMLInputElement).value || undefined;
    const checklistTemplateId = (form.elements.namedItem("checklistTemplateId") as HTMLSelectElement)?.value || undefined;
    const manualRaw = (form.elements.namedItem("manualDowntimeAmount") as HTMLInputElement)?.value ?? "";
    const manualUnit = (form.elements.namedItem("manualDowntimeUnit") as HTMLSelectElement)?.value ?? "min";
    const manualParsed = Number(String(manualRaw).replace(",", "."));
    let manualDowntimeMinutes = 0;
    if (String(manualRaw).trim() !== "" && Number.isFinite(manualParsed) && manualParsed >= 0) {
      manualDowntimeMinutes =
        manualUnit === "h" ? Math.round(manualParsed * 60) : Math.round(manualParsed);
    }
    if (manualDowntimeMinutes > MAX_MANUAL_DOWNTIME_MINUTES) {
      setError("Paro manual demasiado grande (máx. 525600 minutos).");
      setLoading(false);
      return;
    }

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
            ...(canEditAssignee ? { assigneeIds } : {}),
            dueDate: dueDate || null,
            startDate: startDate || null,
            countsMachineDowntime,
            manualDowntimeMinutes,
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
            assigneeIds,
            dueDate: dueDate || null,
            startDate: startDate || null,
            checklistTemplateId: checklistTemplateId || null,
            countsMachineDowntime,
            manualDowntimeMinutes,
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
          Máquina
        </label>
        <select
          id="assetId"
          name="assetId"
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
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
        <AssigneeMultiSelect
          id="wo-assignees"
          users={users}
          value={assigneeIds}
          onChange={setAssigneeIds}
          label="Asignado a"
          emptyHint="Sin asignar"
        />
      )}
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-zinc-700 mb-1">
          Fecha de inicio{" "}
          <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={initial.startDate?.slice(0, 10)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          En la app móvil la tarea solo se muestra a partir de esta fecha. Si se deja vacía, se usa la fecha de vencimiento.
        </p>
      </div>
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
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 space-y-3">
        {!selectedAssetId ? (
          <p className="text-xs text-zinc-600">
            Elige una máquina para poder marcar paro de máquina en esta tarea.
          </p>
        ) : null}
        {selectedAssetId && !machineAllowsDowntime ? (
          <p className="text-xs text-amber-800">
            Esta máquina tiene desactivado el seguimiento de paro; no se registrará tiempo de paro
            hasta que lo actives en la ficha del activo.
          </p>
        ) : null}
        <label className="flex items-start gap-2.5 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={downtimeChecked}
            disabled={!downtimeUiEnabled}
            onChange={(e) => setDowntimeChecked(e.target.checked)}
            className="tap-target mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          <span>
            Esta tarea implica paro de máquina (contar el tiempo por lo que dure en progreso)
          </span>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="manualDowntimeAmount" className="block text-xs font-medium text-zinc-600 mb-1">
              Paro manual adicional (opcional)
            </label>
            <input
              id="manualDowntimeAmount"
              name="manualDowntimeAmount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              defaultValue={
                initial.manualDowntimeMinutes != null && initial.manualDowntimeMinutes > 0
                  ? String(initial.manualDowntimeMinutes)
                  : ""
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="manualDowntimeUnit" className="block text-xs font-medium text-zinc-600 mb-1">
              Unidad
            </label>
            <select
              id="manualDowntimeUnit"
              name="manualDowntimeUnit"
              defaultValue="min"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="min">Minutos</option>
              <option value="h">Horas</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          El paro manual se suma al total de la máquina al completar la tarea. También puedes editarlo
          en el detalle de la tarea.
        </p>
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
