"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Equal,
  GripVertical,
  Minus,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useRouter, useSearchParams } from "next/navigation";
import { parseWorkOrderKind, workOrderKindLabel } from "@/lib/work-order-kind";
import {
  formatWorkOrderElapsedCompact,
  formatWorkOrderElapsedLabel,
  workOrderShouldShowElapsed,
} from "@/lib/work-order-duration";

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
  assigneeAvatarUrl?: string | null;
  boardSortOrder?: number;
  createdAt: string;
  completedAt?: string | null;
  startedAt?: string | null;
};

type BoardStatus = "pending" | "in_progress" | "completed";
type UserOption = { id: string; name: string };

const boardColumns: { key: BoardStatus; title: string }[] = [
  { key: "pending", title: "Pendientes" },
  { key: "in_progress", title: "En progreso" },
  { key: "completed", title: "Terminadas" },
];

/** Jira-style priority: icon shape + color by level */
const priorityVisual: Record<
  string,
  { Icon: LucideIcon; className: string; label: string }
> = {
  low: {
    Icon: ChevronDown,
    className: "text-[#0065FF]",
    label: "Prioridad baja",
  },
  medium: {
    Icon: Equal,
    className: "text-[#E2A100]",
    label: "Prioridad media",
  },
  high: {
    Icon: ChevronUp,
    className: "text-[#FF8B00]",
    label: "Prioridad alta",
  },
  urgent: {
    Icon: ChevronsUp,
    className: "text-[#BF2600]",
    label: "Prioridad urgente",
  },
};

function WorkOrderPriorityIcon({ priority }: { priority: string }) {
  const p = priorityVisual[priority] ?? {
    Icon: Minus,
    className: "text-zinc-400",
    label: `Prioridad: ${priority}`,
  };
  const Icon = p.Icon;
  return (
    <span
      className="inline-flex shrink-0"
      title={p.label}
      aria-label={p.label}
    >
      <Icon className={`h-4 w-4 ${p.className}`} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

function formatDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/** True when the calendar day of the due date is strictly before today (local). */
function isDueDatePast(s: string | null) {
  if (!s) return false;
  const due = new Date(s);
  if (Number.isNaN(due.getTime())) return false;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  return startDue < startToday;
}

const RELATIVE_DUE_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-day delta from today (local): positive = future, negative = past. */
function calendarDaysFromToday(dueStr: string): number | null {
  const due = new Date(dueStr);
  if (Number.isNaN(due.getTime())) return null;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  return Math.round((startDue.getTime() - startToday.getTime()) / DAY_MS);
}

/** Spanish relative due copy; falls back to a short date when far away. */
function formatDueRelative(s: string | null) {
  if (!s) return "—";
  const diff = calendarDaysFromToday(s);
  if (diff === null) return "—";

  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff >= 2 && diff <= RELATIVE_DUE_MAX_DAYS) {
    return `Vence en ${diff} días`;
  }
  if (diff > RELATIVE_DUE_MAX_DAYS) {
    return `Vence el ${formatDate(s)}`;
  }

  if (diff === -1) return "Venció ayer";
  if (diff <= -2 && diff >= -RELATIVE_DUE_MAX_DAYS) {
    return `Venció hace ${-diff} días`;
  }
  return `Venció el ${formatDate(s)}`;
}

/** Insertion index (0..n) for a column drop from pointer Y; excludes the dragged card from hit targets. */
function insertionIndexFromPointer(
  container: HTMLElement,
  clientY: number,
  excludeId: string
): number {
  const elements = [
    ...container.querySelectorAll<HTMLElement>("article[data-woid]"),
  ].filter((el) => el.dataset.woid !== excludeId);
  for (let i = 0; i < elements.length; i += 1) {
    const box = elements[i]!.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    if (clientY < mid) return i;
  }
  return elements.length;
}

export function WorkOrderList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQueryRaw = (searchParams.get("q") ?? "").trim();
  const isSearching = searchQueryRaw.length > 0;
  const q = searchQueryRaw.toLowerCase();
  const [items, setItems] = useState<WorkOrderRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<BoardStatus | null>(null);
  const [insertIndicator, setInsertIndicator] = useState<{
    column: BoardStatus;
    index: number;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Re-render active tasks ~every minute so transcurrido stays fresh */
  const [durationTick, setDurationTick] = useState(0);

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

  const needsLiveDuration = useMemo(
    () => filteredItems.some((w) => w.status === "in_progress"),
    [filteredItems]
  );

  useEffect(() => {
    if (!needsLiveDuration) return;
    const id = window.setInterval(() => setDurationTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [needsLiveDuration]);

  // Reordering is safe as long as we are not in text search mode.
  // With assignee filter active, `items` is still the full dataset for that filtered scope.
  const canReorderColumn = !isSearching;

  async function persistColumnOrder(
    column: BoardStatus,
    orderedIds: string[]
  ) {
    const previousItems = items;
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    setError(null);
    setItems((list) =>
      list.map((wo) =>
        wo.status === column && orderMap.has(wo.id)
          ? { ...wo, boardSortOrder: orderMap.get(wo.id)! }
          : wo
      )
    );
    try {
      const res = await fetch("/api/work-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: column, orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems(previousItems);
        setError(data.error ?? "No se pudo guardar el orden.");
      }
    } catch {
      setItems(previousItems);
      setError("No se pudo guardar el orden.");
    }
  }

  async function moveWorkOrder(workOrderId: string, to: BoardStatus) {
    const current = items.find((item) => item.id === workOrderId);
    if (!current || current.status === to) return;
    const previousItems = items;
    const targetMax = Math.max(
      -1,
      ...items
        .filter((w) => w.status === to && w.id !== workOrderId)
        .map((w) => w.boardSortOrder ?? 0)
    );
    const nextSort = targetMax + 1;
    setError(null);
    setSavingId(workOrderId);
    setItems((list) =>
      list.map((wo) =>
        wo.id === workOrderId
          ? { ...wo, status: to, boardSortOrder: nextSort }
          : wo
      )
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
          const columnItems = filteredItems
            .filter((wo) => wo.status === column.key)
            .sort((a, b) => {
              const ao = a.boardSortOrder ?? 0;
              const bo = b.boardSortOrder ?? 0;
              if (ao !== bo) return ao - bo;
              return (
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
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
              <div
                className="space-y-2 min-h-[4rem]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget(column.key);
                  if (!draggingId) return;
                  const idx = insertionIndexFromPointer(
                    e.currentTarget,
                    e.clientY,
                    draggingId
                  );
                  setInsertIndicator({ column: column.key, index: idx });
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget(null);
                  setInsertIndicator(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (!id) return;
                  setDraggingId(null);
                  const current = items.find((w) => w.id === id);
                  if (!current) return;
                  const insertIdx = insertionIndexFromPointer(
                    e.currentTarget,
                    e.clientY,
                    id
                  );
                  if (current.status === column.key) {
                    if (!canReorderColumn) return;
                    const ordered = columnItems.map((w) => w.id);
                    const from = ordered.indexOf(id);
                    if (from === -1) return;
                    let to = insertIdx;
                    if (from < to) to -= 1;
                    if (from === to) return;
                    const next = [...ordered];
                    next.splice(from, 1);
                    next.splice(to, 0, id);
                    await persistColumnOrder(column.key, next);
                  } else {
                    await moveWorkOrder(id, column.key);
                  }
                }}
              >
                {columnItems.map((wo, i) => {
                  void durationTick;
                  const overdue = isDueDatePast(wo.dueDate);
                  const dueLineClass = overdue ? "text-red-600" : "text-zinc-400";
                  const openWorkOrder = () => {
                    router.push(`/tareas/${wo.id}`);
                  };
                  const showElapsed = workOrderShouldShowElapsed(
                    wo.status,
                    wo.startedAt
                  );
                  const nowMs = Date.now();
                  const elapsedCompact = showElapsed
                    ? formatWorkOrderElapsedCompact(
                        wo.createdAt,
                        wo.status,
                        wo.completedAt ?? null,
                        nowMs
                      )
                    : null;
                  const elapsedPrefix =
                    wo.status === "completed" ? "Duración" : "Transcurrido";
                  const elapsedTitle = showElapsed
                    ? formatWorkOrderElapsedLabel(
                        wo.createdAt,
                        wo.status,
                        wo.completedAt ?? null,
                        nowMs
                      )
                    : "";
                  const cardAriaLabel =
                    wo.folio != null
                      ? `Folio ${wo.folio}: ${wo.title}. Abrir detalle.`
                      : `${wo.title}. Abrir detalle.`;
                  const showInsertBefore =
                    insertIndicator?.column === column.key &&
                    insertIndicator.index === i &&
                    draggingId != null;
                  return (
                    <Fragment key={wo.id}>
                      {showInsertBefore ? (
                        <div
                          className="h-0.5 rounded-full bg-primary-500"
                          aria-hidden
                        />
                      ) : null}
                      <article
                      data-woid={wo.id}
                      role="link"
                      tabIndex={savingId === wo.id ? -1 : 0}
                      aria-label={cardAriaLabel}
                      draggable={savingId !== wo.id}
                      onDragStart={(e) => {
                        setDraggingId(wo.id);
                        e.dataTransfer.setData("text/plain", wo.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                        setInsertIndicator(null);
                      }}
                      onClick={openWorkOrder}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openWorkOrder();
                        }
                      }}
                      className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition cursor-pointer hover:border-zinc-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        draggingId === wo.id ? "opacity-60" : ""
                      } ${savingId === wo.id ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                          {wo.title}
                        </span>
                        <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
                      </div>
                      <p
                        className="mt-1 text-xs font-medium text-primary-700"
                        title={wo.folio == null ? wo.id : undefined}
                      >
                        {wo.folio != null
                          ? `Folio ${wo.folio}`
                          : `Tarea ${wo.id.slice(0, 8)}…`}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {wo.assetName
                          ? `${wo.assetName}${wo.assetAssetId ? ` (${wo.assetAssetId})` : ""}`
                          : "Sin activo"}
                      </p>
                      {showElapsed ? (
                        <p
                          className="mt-1 flex min-w-0 items-center gap-1 text-xs text-zinc-500"
                          title={elapsedTitle}
                        >
                          <Clock
                            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
                            aria-hidden
                          />
                          <span className="min-w-0 truncate tabular-nums">
                            {elapsedPrefix} · {elapsedCompact}
                          </span>
                        </p>
                      ) : null}
                      <div
                        className={`mt-2 flex items-center gap-2 ${
                          wo.status === "completed"
                            ? "justify-end"
                            : "justify-between"
                        }`}
                      >
                        {wo.status !== "completed" ? (
                          <div
                            className={`flex min-w-0 items-center gap-1 text-xs ${dueLineClass}`}
                          >
                            <CalendarDays
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden
                            />
                            <span
                              className="truncate"
                              title={
                                wo.dueDate
                                  ? new Date(wo.dueDate).toLocaleDateString("es", {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })
                                  : undefined
                              }
                            >
                              {formatDueRelative(wo.dueDate)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {wo.assigneeName ? (
                            <span
                              className="inline-flex shrink-0"
                              title={wo.assigneeName}
                            >
                              <UserAvatar
                                userId={wo.assigneeId ?? ""}
                                name={wo.assigneeName}
                                avatarUrl={wo.assigneeAvatarUrl}
                                size="sm"
                                className="!h-6 !w-6 !text-[9px] ring-1 ring-zinc-200"
                              />
                              <span className="sr-only">{wo.assigneeName}</span>
                            </span>
                          ) : null}
                          <WorkOrderPriorityIcon priority={wo.priority} />
                        </div>
                      </div>
                    </article>
                    </Fragment>
                  );
                })}
                {insertIndicator?.column === column.key &&
                insertIndicator.index === columnItems.length &&
                draggingId != null ? (
                  <div className="h-0.5 rounded-full bg-primary-500" aria-hidden />
                ) : null}
                {columnItems.length === 0 ? (
                  <>
                    {draggingId && insertIndicator?.column === column.key ? (
                      <div
                        className="mb-2 h-0.5 rounded-full bg-primary-500"
                        aria-hidden
                      />
                    ) : null}
                    <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
                      Arrastra tareas aquí
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
