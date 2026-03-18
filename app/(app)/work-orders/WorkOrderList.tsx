"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type WorkOrderRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assetName: string | null;
  assetAssetId: string | null;
  assigneeName: string | null;
  createdAt: string;
};

const statusColors: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

const priorityColors: Record<string, string> = {
  low: "text-zinc-500",
  medium: "text-zinc-700",
  high: "text-amber-600",
  urgent: "text-red-600",
};

function formatDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function WorkOrderList() {
  const [items, setItems] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    fetch(`/api/work-orders?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-zinc-100 animate-pulse"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-zinc-500">Aún no hay órdenes de trabajo.</p>
        <Link
          href="/work-orders/new"
          className="mt-3 inline-block text-primary-600 font-medium"
        >
          Crear una
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
        {["", "open", "in_progress", "completed"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium tap-target ${
              filter === s
                ? "bg-primary-600 text-white"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {s === "" ? "Todas" : s === "open" ? "Abiertas" : s === "in_progress" ? "En curso" : s === "completed" ? "Completadas" : s.replace("_", " ")}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.map((wo) => (
          <li key={wo.id}>
            <Link
              href={`/work-orders/${wo.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-primary-200 hover:bg-primary-50/50 transition tap-target"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 truncate">{wo.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[wo.status] ?? "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {wo.status === "open" ? "Abierta" : wo.status === "in_progress" ? "En curso" : wo.status === "completed" ? "Completada" : wo.status === "cancelled" ? "Cancelada" : wo.status.replace("_", " ")}
                    </span>
                    <span className={priorityColors[wo.priority] ?? ""}>
                      {wo.priority === "low" ? "Baja" : wo.priority === "medium" ? "Media" : wo.priority === "high" ? "Alta" : wo.priority === "urgent" ? "Urgente" : wo.priority}
                    </span>
                    {wo.assetName && (
                      <span className="text-zinc-500 truncate">
                        {wo.assetName}
                        {wo.assetAssetId ? ` (${wo.assetAssetId})` : ""}
                      </span>
                    )}
                    <span className="text-zinc-400">
                      Vence {formatDate(wo.dueDate)}
                    </span>
                  </div>
                  {wo.assigneeName && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {wo.assigneeName}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-400 shrink-0" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
