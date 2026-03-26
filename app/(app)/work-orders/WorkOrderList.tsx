"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { useSearchParams } from "next/navigation";

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

type BoardStatus = "open" | "in_progress" | "completed";

const boardColumns: { key: BoardStatus; title: string }[] = [
  { key: "open", title: "Abiertas" },
  { key: "in_progress", title: "En progreso" },
  { key: "completed", title: "Terminadas" },
];

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
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [items, setItems] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<BoardStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/work-orders")
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
  }, []);

  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter((wo) => {
      const haystack = [
        wo.title,
        wo.assetName,
        wo.assetAssetId,
        wo.assigneeName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, q]);

  async function moveWorkOrder(workOrderId: string, to: BoardStatus) {
    const current = items.find((item) => item.id === workOrderId);
    if (!current || current.status === to) return;
    const previousItems = items;
    setError(null);
    setSavingId(workOrderId);
    setItems((list) =>
      list.map((wo) => (wo.id === workOrderId ? { ...wo, status: to } : wo))
    );
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems(previousItems);
        setError(data.error ?? "No se pudo actualizar el estado.");
      }
    } catch {
      setItems(previousItems);
      setError("No se pudo actualizar el estado.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-zinc-200 bg-zinc-100/70 dark:border-slate-700 dark:bg-slate-800/70 animate-pulse"
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
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}
      {q && (
        <p className="text-sm text-zinc-500">
          Buscando: <span className="font-medium text-zinc-700">{q}</span>
        </p>
      )}
      {q && filteredItems.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No se encontraron ordenes para esa busqueda.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {boardColumns.map((column) => {
          const columnItems = filteredItems.filter((wo) => wo.status === column.key);
          const isDropActive = dropTarget === column.key;
          return (
            <section
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(column.key);
              }}
              onDragLeave={() => {
                setDropTarget((current) => (current === column.key ? null : current));
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setDropTarget(null);
                const id = e.dataTransfer.getData("text/plain");
                if (!id) return;
                // Ensure drag visual state is always cleared, even if dragend doesn't fire.
                setDraggingId(null);
                await moveWorkOrder(id, column.key);
              }}
              className={`rounded-xl border bg-white p-3 min-h-[18rem] ${
                isDropActive ? "border-primary-400 ring-2 ring-primary-100" : "border-zinc-200"
              }`}
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">{column.title}</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {columnItems.length}
                </span>
              </header>
              <div className="space-y-2">
                {columnItems.map((wo) => (
                  <article
                    key={wo.id}
                    draggable={savingId !== wo.id}
                    onDragStart={(e) => {
                      setDraggingId(wo.id);
                      e.dataTransfer.setData("text/plain", wo.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition ${
                      draggingId === wo.id ? "opacity-60" : ""
                    } ${savingId === wo.id ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:text-primary-700"
                      >
                        {wo.title}
                      </Link>
                      <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          statusColors[wo.status] ?? "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {wo.status === "open"
                          ? "Abierta"
                          : wo.status === "in_progress"
                            ? "En curso"
                            : wo.status === "completed"
                              ? "Completada"
                              : wo.status === "cancelled"
                                ? "Cancelada"
                                : wo.status.replace("_", " ")}
                      </span>
                      <span className={priorityColors[wo.priority] ?? ""}>
                        {wo.priority === "low"
                          ? "Baja"
                          : wo.priority === "medium"
                            ? "Media"
                            : wo.priority === "high"
                              ? "Alta"
                              : wo.priority === "urgent"
                                ? "Urgente"
                                : wo.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {wo.assetName
                        ? `${wo.assetName}${wo.assetAssetId ? ` (${wo.assetAssetId})` : ""}`
                        : "Sin activo"}
                    </p>
                    <p className="text-xs text-zinc-400">Vence {formatDate(wo.dueDate)}</p>
                    {wo.assigneeName && (
                      <p className="mt-1 text-xs text-zinc-500">{wo.assigneeName}</p>
                    )}
                  </article>
                ))}
                {columnItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
                    Arrastra ordenes aqui
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
