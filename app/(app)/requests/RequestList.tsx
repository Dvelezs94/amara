"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type RequestRow = {
  id: string;
  description: string;
  status: string;
  workOrderId: string | null;
  createdAt: string;
  requesterName: string | null;
  assetName: string | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  converted: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export function RequestList() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    fetch(`/api/requests?${params}`)
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
            className="h-20 rounded-xl bg-zinc-100 animate-pulse"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-zinc-500">Aún no hay solicitudes.</p>
        <Link
          href="/requests/new"
          className="mt-3 inline-block text-primary-600 font-medium"
        >
          Enviar una
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
        {["", "pending", "converted"].map((s) => (
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
            {s === "" ? "Todas" : s === "pending" ? "Pendientes" : s === "converted" ? "Convertidas" : s}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/requests/${r.id}`}
              className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-4 hover:border-primary-200 hover:bg-primary-50/50 transition tap-target"
            >
              <div className="min-w-0 flex-1">
                <p className="text-zinc-900 line-clamp-2">{r.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusColors[r.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {r.status === "pending" ? "Pendiente" : r.status === "converted" ? "Convertida" : r.status === "cancelled" ? "Cancelada" : r.status}
                  </span>
                  {r.requesterName && (
                    <span className="text-xs text-zinc-500">{r.requesterName}</span>
                  )}
                  {r.assetName && (
                    <span className="text-xs text-zinc-500">{r.assetName}</span>
                  )}
                  <span className="text-xs text-zinc-400">
                    {new Date(r.createdAt).toLocaleDateString("es")}
                  </span>
                </div>
                {r.workOrderId && (
                  <p className="mt-1 text-xs text-primary-600">
                    Orden #{r.workOrderId.slice(0, 8)}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
