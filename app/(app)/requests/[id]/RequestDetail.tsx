"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { useSetPageHeader } from "@/components/PageHeaderContext";

function formatDate(s: string | Date) {
  return new Date(s).toLocaleString("es-MX", { timeZone: APP_TIME_ZONE });
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  converted: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

type RequestData = {
  id: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
  workOrderId: string | null;
  createdAt: string | Date;
  requester: { id: string; name: string } | null;
  asset: { id: string; name: string; assetId: string } | null;
};

function priorityLabel(priority: RequestData["priority"]) {
  if (priority === "low") return "Baja";
  if (priority === "medium") return "Media";
  if (priority === "high") return "Alta";
  return "Urgente";
}

export function RequestDetail({ request }: { request: RequestData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useSetPageHeader({ title: "Solicitud" });

  async function convert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.workOrderId) {
        router.push(`/tareas/${data.workOrderId}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setLoading(true);
    try {
      await fetch(`/api/requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${
            statusColors[request.status] ?? "bg-zinc-100 text-zinc-600"
          }`}
        >
          {request.status === "pending" ? "Pendiente" : request.status === "converted" ? "Convertida" : request.status === "cancelled" ? "Cancelada" : request.status}
        </span>
        <p className="mt-2 text-sm text-zinc-600">
          Prioridad: <span className="font-medium text-zinc-900">{priorityLabel(request.priority)}</span>
        </p>
      </div>
      <p className="text-zinc-900 whitespace-pre-wrap">{request.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {request.requester && (
          <div>
            <p className="text-zinc-500">Solicitante</p>
            <p className="font-medium text-zinc-900">{request.requester.name}</p>
          </div>
        )}
        {request.asset && (
          <div>
            <p className="text-zinc-500">Activo</p>
            <Link
              href={`/assets/${request.asset.id}`}
              className="font-medium text-primary-600"
            >
              {request.asset.name} ({request.asset.assetId})
            </Link>
          </div>
        )}
        <div>
          <p className="text-zinc-500">Enviada el</p>
          <p className="font-medium text-zinc-900">
            {formatDate(request.createdAt)}
          </p>
        </div>
      </div>
      {request.status === "pending" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={convert}
            disabled={loading}
            className="rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium tap-target disabled:opacity-60"
          >
            {loading ? "Creando…" : "Convertir en orden de trabajo"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={loading}
            className="rounded-xl border border-zinc-300 py-2.5 px-4 text-sm font-medium text-zinc-700 tap-target disabled:opacity-60"
          >
            Cancelar solicitud
          </button>
        </div>
      )}
      {request.status === "converted" && request.workOrderId && (
        <Link
          href={`/tareas/${request.workOrderId}`}
          className="inline-block rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium"
        >
          Ver orden de trabajo
        </Link>
      )}
    </div>
  );
}
