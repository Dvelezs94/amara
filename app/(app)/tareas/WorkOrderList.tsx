"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";

type WorkOrderRow = {
  id: string;
  folio: number | null;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  kind?: string | null;
  assetName: string | null;
  assetAssetId: string | null;
  assigneeName: string | null;
  assigneeId?: string | null;
  createdAt: string;
};

type BoardStatus = "open" | "in_progress" | "completed";
type UserOption = { id: string; name: string };

const boardColumns: { key: BoardStatus; title: string }[] = [
  { key: "open", title: "Abiertas" },
  { key: "in_progress", title: "En progreso" },
  { key: "completed", title: "Terminadas" },
];

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

export function WorkOrderList({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const searchParams = useSearchParams();
  const searchQueryRaw = (searchParams.get("q") ?? "").trim();
  const isSearching = searchQueryRaw.length > 0;
  const q = searchQueryRaw.toLowerCase();
  const [items, setItems] = useState<WorkOrderRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    () => currentUserId ?? null
  );
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<BoardStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query =
      isSearching
        ? ""
        : selectedAssigneeId
          ? `?assigneeId=${encodeURIComponent(selectedAssigneeId)}`
          : "";
    fetch(`/api/work-orders${query}`)
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
  }, [selectedAssigneeId, isSearching]);

  const filteredItems = useMemo(() => {
    if (!q) return items;
    const folioPhrase = q.replace(/^folio\s*#?\s*/i, "").replace(/^#\s*/, "").trim();
    const isNumericFolio = /^\d+$/.test(folioPhrase);
    return items.filter((wo) => {
      if (isNumericFolio && wo.folio != null && String(wo.folio) === folioPhrase) {
        return true;
      }
      const k = parseWorkOrderKind(wo.kind);
      const parts: (string | null | undefined)[] = [
        wo.title,
        wo.assetName,
        wo.assetAssetId,
        wo.assigneeName,
        workOrderKindLabel(k),
      ];
      if (wo.folio != null) {
        parts.push(String(wo.folio), `folio ${wo.folio}`, `#${wo.folio}`);
      }
      const haystack = parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q) || (folioPhrase && haystack.includes(folioPhrase));
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
        <p className="text-zinc-500">Aún no hay tareas.</p>
        <Link
          href="/tareas/new"
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
      {isSearching && (
        <div className="text-sm text-zinc-500">
          <p>
            Buscando:{" "}
            <span className="font-medium text-zinc-700">{searchQueryRaw}</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            La búsqueda incluye tareas de todos los usuarios.
          </p>
        </div>
      )}
      {q && filteredItems.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          No se encontraron tareas para esa búsqueda.
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-500">Asignado:</p>
          {selectedAssigneeId ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium">
              <span className="text-zinc-900 shrink-0">
                {users.find((u) => u.id === selectedAssigneeId)?.name ?? "Usuario"}
              </span>
              <button
                type="button"
                onClick={() => setSelectedAssigneeId(null)}
                className="border-0 bg-transparent p-0 font-bold text-[#FFBF8A] hover:text-accent-200"
              >
                Quitar
              </button>
            </span>
          ) : (
            <span className="text-xs text-zinc-500">Todos</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedAssigneeId(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedAssigneeId == null
                ? "border-primary-500 bg-primary-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Todos
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedAssigneeId(user.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                selectedAssigneeId === user.id
                  ? "border-primary-500 bg-primary-600 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {user.name}
            </button>
          ))}
        </div>
      </div>
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
                        href={`/tareas/${wo.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:text-primary-700"
                      >
                        {wo.folio != null ? (
                          <span className="text-primary-700">Folio {wo.folio}</span>
                        ) : null}
                        {wo.folio != null ? " · " : null}
                        {wo.title}
                      </Link>
                      <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-normal ${workOrderKindBadgeClass(
                          parseWorkOrderKind(wo.kind),
                          true
                        )}`}
                      >
                        {workOrderKindLabel(parseWorkOrderKind(wo.kind))}
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
                    Arrastra tareas aquí
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
