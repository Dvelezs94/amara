"use client";

import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  GripVertical,
  Trash2,
  Plus,
  CircleHelp,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Equal,
  Minus,
  Pencil,
  Timer,
  Repeat,
  Factory,
  PieChart,
  Gauge,
  ListTodo,
  BarChart3,
} from "lucide-react";
import { AnalyticsChartCard } from "@/components/AnalyticsChartCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  DashboardDateRangeModal,
  formatDashboardRangeTrigger,
} from "@/components/DashboardDateRangeModal";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";
import type { DashboardKpis } from "@/lib/dashboard-kpis";
import {
  defaultLast30DaysRange,
  inclusiveLocalDayCount,
  isDefaultLast30DaysRange,
} from "@/lib/dashboard-date-range";
import {
  DASHBOARD_KPI_CARDS,
  dashboardEmptyCopy,
  formatDashboardContextBanner,
  moveDashboardBlock,
  parseDashboardBlockOrder,
  type DashboardBlockId,
  type DashboardEmptySection,
  type DashboardKpiId,
  type DashboardKpiTone,
} from "@/lib/dashboard-presentation";
import { useWorkOrderStatusColors } from "@/components/WorkOrderStatusColorsProvider";
import { workOrderStatusBadgeStyle } from "@/lib/work-order-status-colors";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { useSetPageHeader } from "@/components/PageHeaderContext";
import { DashboardChecklistsSection } from "./DashboardChecklistsSection";

type Widget = {
  id: string;
  templateId: string;
  templateName: string;
  fieldLabel: string;
  /** Múltiples campos del mismo tipo para un mismo gráfico */
  fieldLabels?: string[];
  chartType?: "line" | "bar" | "pie" | string;
  thresholds?: { id: string; value: number; label?: string; color?: string }[];
  axisLimits?: {
    yAuto: boolean;
    yMin: number | null;
    yMax: number | null;
    xAuto: boolean;
    xMin: number | null;
    xMax: number | null;
  };
  chartTitle?: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sortOrder: number;
};

type PendingOrder = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assetName: string | null;
  kind?: string | null;
};

type UpcomingEvent = {
  id: string;
  name: string;
  nextRunAt: string | null;
  assetName: string | null;
  assigneeName: string | null;
};

const CHART_AUTO_REFRESH_KEY = "dashboard-chart-auto-refresh";
const CHART_REFRESH_LEGACY_MS_KEY = "dashboard-chart-refresh-ms";
const CHART_REFRESH_INTERVAL_MS = 30_000;
const LIST_PAGE_SIZE = 5;
const BLOCK_ORDER_KEY = "dashboard-block-order-v1";
const BLOCK_DRAG_PREFIX = "block:";

const kpiIconByKey = {
  timer: Timer,
  cycle: Repeat,
  factory: Factory,
  split: PieChart,
  gauge: Gauge,
} as const;

function kpiToneClasses(tone: DashboardKpiTone): {
  card: string;
  iconWrap: string;
  bar: string;
} {
  if (tone === "accent") {
    return {
      card: "border-accent-200 bg-white shadow-sm",
      iconWrap: "bg-accent-50 text-accent-600",
      bar: "bg-accent-500",
    };
  }
  if (tone === "primary") {
    return {
      card: "border-primary-200 bg-white shadow-sm",
      iconWrap: "bg-primary-50 text-primary-700",
      bar: "bg-primary-600",
    };
  }
  return {
    card: "border-zinc-200 bg-white shadow-sm",
    iconWrap: "bg-zinc-100 text-zinc-600",
    bar: "bg-zinc-400",
  };
}

function DashboardEmptyState({ section }: { section: DashboardEmptySection }) {
  const copy = dashboardEmptyCopy[section];
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center">
      <p className="text-sm text-zinc-600">{copy.message}</p>
      <Link
        href={copy.href}
        className="mt-2 text-sm font-medium text-primary-600 hover:underline"
      >
        {copy.cta}
      </Link>
    </div>
  );
}

function DashboardSortableBlock({
  id,
  orderIndex,
  dragged,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}: {
  id: DashboardBlockId;
  orderIndex: number;
  dragged: boolean;
  dropTarget: boolean;
  onDragStart: (e: DragEvent, id: DashboardBlockId) => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDrop: (e: DragEvent, index: number) => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{ order: orderIndex }}
      onDragOver={(e) => onDragOver(e, orderIndex)}
      onDrop={(e) => onDrop(e, orderIndex)}
      onDragEnd={onDragEnd}
      className={`min-w-0 ${dragged ? "opacity-60" : ""} ${
        dropTarget ? "rounded-xl ring-2 ring-primary-400 ring-offset-2 ring-offset-zinc-200" : ""
      }`}
    >
      <div className="mb-2 flex items-center">
        <button
          type="button"
          draggable
          onDragStart={(e) => onDragStart(e, id)}
          className="inline-flex cursor-grab items-center gap-1 rounded-md px-1 py-0.5 text-zinc-400 hover:bg-white hover:text-zinc-600 active:cursor-grabbing"
          aria-label="Reordenar sección"
          title="Arrastrar para reordenar esta sección"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wide">Mover</span>
        </button>
      </div>
      {children}
    </div>
  );
}

const priorityVisual: Record<
  PendingOrder["priority"],
  { Icon: typeof Equal; className: string; label: string }
> = {
  low: { Icon: ChevronDown, className: "text-[#0065FF]", label: "Prioridad baja" },
  medium: { Icon: Equal, className: "text-[#E2A100]", label: "Prioridad media" },
  high: { Icon: ChevronUp, className: "text-[#FF8B00]", label: "Prioridad alta" },
  urgent: { Icon: ChevronsUp, className: "text-[#BF2600]", label: "Prioridad urgente" },
};

const priorityLabelEs: Record<PendingOrder["priority"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export default function DashboardPage() {
  const { colors: statusColors } = useWorkOrderStatusColors();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [pendingVisibleCount, setPendingVisibleCount] = useState(LIST_PAGE_SIZE);
  const [eventsVisibleCount, setEventsVisibleCount] = useState(LIST_PAGE_SIZE);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => defaultLast30DaysRange());
  const initialFetchDone = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const WIDGET_SIZE_KEY = "dashboard-widget-sizes-v1";
  const [blockOrder, setBlockOrder] = useState<DashboardBlockId[]>(() =>
    parseDashboardBlockOrder(null)
  );
  const [draggedBlockId, setDraggedBlockId] = useState<DashboardBlockId | null>(null);
  const [blockDropIndex, setBlockDropIndex] = useState<number | null>(null);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [chartAutoRefresh, setChartAutoRefresh] = useState(true);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [widgetDeleteConfirmId, setWidgetDeleteConfirmId] = useState<string | null>(null);
  const [widgetDeleteLoading, setWidgetDeleteLoading] = useState(false);

  const showLists = isDefaultLast30DaysRange(range);

  useSetPageHeader({
    title: "Dashboard",
    filters: (
      <button
        type="button"
        onClick={() => setRangeModalOpen(true)}
        className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:max-w-xs"
        aria-label="Cambiar rango de fechas"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
        <span className="hidden truncate sm:inline">
          {formatDashboardRangeTrigger(range)}
        </span>
        <span className="sm:hidden">Fechas</span>
      </button>
    ),
    actions: (
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Añadir gráfico</span>
        <span className="sm:hidden">Gráfico</span>
      </Link>
    ),
  });

  function patchWidget(id: string, patch: Partial<Widget>) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  /** Evita que los clics en la barra de herramientas inicien el arrastre del widget. */
  function stopWidgetDrag(e: MouseEvent | PointerEvent) {
    e.stopPropagation();
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIDGET_SIZE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, "sm" | "md" | "lg">;
        setWidgetSizes(parsed ?? {});
      }
      const auto = localStorage.getItem(CHART_AUTO_REFRESH_KEY);
      if (auto === "0") {
        setChartAutoRefresh(false);
      } else if (auto === "1") {
        setChartAutoRefresh(true);
      } else {
        const legacy = localStorage.getItem(CHART_REFRESH_LEGACY_MS_KEY);
        if (legacy && legacy !== "" && !Number.isNaN(Number(legacy))) {
          setChartAutoRefresh(Number(legacy) >= 5000);
        }
      }
      const blockRaw = localStorage.getItem(BLOCK_ORDER_KEY);
      if (blockRaw) {
        setBlockOrder(parseDashboardBlockOrder(JSON.parse(blockRaw)));
      }
    } catch {
      setWidgetSizes({});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!initialFetchDone.current) setLoading(true);
    const includeLists = isDefaultLast30DaysRange(range) ? "1" : "0";
    const qs = new URLSearchParams({
      from: range.from,
      to: range.to,
      includeLists,
    });
    Promise.all([
      fetch("/api/dashboard/widgets").then(async (r) => {
        if (!r.ok) throw new Error("widgets");
        return r.json();
      }),
      fetch(`/api/dashboard/overview?${qs}`).then(async (r) => {
        if (!r.ok) throw new Error("overview");
        return r.json();
      }),
    ])
      .then(([widgetsData, overviewData]) => {
        if (cancelled) return;
        setWidgets(Array.isArray(widgetsData) ? widgetsData : []);
        setPendingOrders(
          Array.isArray(overviewData?.pendingOrders) ? overviewData.pendingOrders : []
        );
        setUpcomingEvents(
          Array.isArray(overviewData?.upcomingEvents) ? overviewData.upcomingEvents : []
        );
        setPendingVisibleCount(LIST_PAGE_SIZE);
        setEventsVisibleCount(LIST_PAGE_SIZE);
        setKpis(overviewData?.kpis ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setWidgets([]);
        setPendingOrders([]);
        setUpcomingEvents([]);
        setKpis(null);
      })
      .finally(() => {
        if (!cancelled) {
          initialFetchDone.current = true;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  function setWidgetSize(id: string, size: "sm" | "md" | "lg") {
    setWidgetSizes((prev) => {
      const next = { ...prev, [id]: size };
      localStorage.setItem(WIDGET_SIZE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: APP_TIME_ZONE,
    });
  }

  function statusLabel(status: PendingOrder["status"]) {
    if (status === "pending") return "Pendiente";
    if (status === "in_progress") return "En progreso";
    if (status === "completed") return "Completada";
    return "Cancelada";
  }

  function renderPriorityIcon(priority: PendingOrder["priority"]) {
    const p = priorityVisual[priority] ?? {
      Icon: Minus,
      className: "text-zinc-400",
      label: `Prioridad: ${priority}`,
    };
    const Icon = p.Icon;
    return (
      <span className="inline-flex shrink-0" title={p.label} aria-label={p.label}>
        <Icon className={`h-4 w-4 ${p.className}`} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  function formatKpiValue(
    value: number | null | undefined,
    suffix = ""
  ) {
    if (value == null || Number.isNaN(value)) return "—";
    return `${value}${suffix}`;
  }

  function kpiDisplayValue(id: DashboardKpiId): string {
    if (id === "mttr") return formatKpiValue(kpis?.mttrHours, " h");
    if (id === "inactividad") return formatKpiValue(kpis?.downtimeHours, " h");
    if (id === "paro") return formatKpiValue(kpis?.machineDowntimeHours, " h");
    if (id === "planificado") return formatKpiValue(kpis?.plannedPct, "%");
    return formatKpiValue(kpis?.oee, "%");
  }

  function kpiSubtitle(id: DashboardKpiId): string {
    const days = kpis?.windowDays ?? 30;
    if (id === "mttr") return `Tiempo medio de reparación (${days} días)`;
    if (id === "inactividad") return `Horas ciclo creación–cierre (${days} días)`;
    if (id === "paro") return `En ventana de ${days} días (por fecha de creación)`;
    if (id === "planificado") {
      return `Planificado ${kpis?.plannedCount ?? 0} · No planificado ${kpis?.unplannedCount ?? 0}`;
    }
    return `Estimado por disponibilidad en ventana de ${days} días`;
  }

  const windowDaysForBanner =
    kpis?.windowDays ?? inclusiveLocalDayCount(range.from, range.to);
  const contextBanner = formatDashboardContextBanner({
    from: range.from,
    to: range.to,
    windowDays: windowDaysForBanner,
  });

  async function confirmRemoveWidget() {
    const id = widgetDeleteConfirmId;
    if (!id) return;
    setWidgetDeleteLoading(true);
    try {
      await fetch(`/api/dashboard/widgets/${id}`, { method: "DELETE" });
      setWidgets((prev) => prev.filter((w) => w.id !== id));
      if (editingWidgetId === id) setEditingWidgetId(null);
      setWidgetDeleteConfirmId(null);
    } finally {
      setWidgetDeleteLoading(false);
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  function handleDragLeave() {
    setDropIndex(null);
  }

  async function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id || !draggedId || draggedId !== id) {
      setDraggedId(null);
      return;
    }
    setDraggedId(null);
    const fromIndex = widgets.findIndex((w) => w.id === id);
    if (fromIndex === -1 || fromIndex === toIndex) return;
    const next = [...widgets];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setWidgets(next);
    await fetch("/api/dashboard/widgets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetIds: next.map((w) => w.id) }),
    });
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropIndex(null);
  }

  function persistBlockOrder(next: DashboardBlockId[]) {
    setBlockOrder(next);
    try {
      localStorage.setItem(BLOCK_ORDER_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function handleBlockDragStart(e: React.DragEvent, id: DashboardBlockId) {
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${BLOCK_DRAG_PREFIX}${id}`);
  }

  function handleBlockDragOver(e: React.DragEvent, index: number) {
    if (!draggedBlockId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setBlockDropIndex(index);
  }

  function handleBlockDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    setBlockDropIndex(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw.startsWith(BLOCK_DRAG_PREFIX)) {
      setDraggedBlockId(null);
      return;
    }
    const id = raw.slice(BLOCK_DRAG_PREFIX.length) as DashboardBlockId;
    const fromIndex = blockOrder.indexOf(id);
    setDraggedBlockId(null);
    if (fromIndex === -1) return;
    persistBlockOrder(moveDashboardBlock(blockOrder, fromIndex, toIndex));
  }

  function handleBlockDragEnd() {
    setDraggedBlockId(null);
    setBlockDropIndex(null);
  }

  const sortableBlockProps = (id: DashboardBlockId) => ({
    id,
    orderIndex: blockOrder.indexOf(id),
    dragged: draggedBlockId === id,
    dropTarget:
      blockDropIndex === blockOrder.indexOf(id) && draggedBlockId != null && draggedBlockId !== id,
    onDragStart: handleBlockDragStart,
    onDragOver: handleBlockDragOver,
    onDrop: handleBlockDrop,
    onDragEnd: handleBlockDragEnd,
  });

  return (
    <div className="space-y-5">
      <DashboardDateRangeModal
        open={rangeModalOpen}
        onOpenChange={setRangeModalOpen}
        value={range}
        onApply={setRange}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
        <p className="text-sm font-medium text-primary-900">
          {formatDashboardRangeTrigger(range)}
        </p>
        <p className="text-xs text-primary-800 sm:text-sm">{contextBanner}</p>
      </div>

      <p className="text-xs text-zinc-500">
        Arrastra <span className="font-medium text-zinc-600">Mover</span> para reordenar las secciones.
        Los gráficos se reordenan desde el asa de cada tarjeta.
      </p>

      <div className="flex flex-col gap-5">
      <DashboardSortableBlock {...sortableBlockProps("kpis")}>
      {loading ? (
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"
          aria-busy="true"
          aria-label="Cargando indicadores"
        >
          {DASHBOARD_KPI_CARDS.map((card) => (
            <div
              key={card.id}
              className="h-[8.5rem] animate-pulse rounded-xl bg-zinc-200"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {DASHBOARD_KPI_CARDS.map((card) => {
            const Icon = kpiIconByKey[card.icon];
            const tone = kpiToneClasses(card.tone);
            return (
              <section
                key={card.id}
                className={`relative overflow-hidden rounded-xl border p-4 ${tone.card} ${
                  card.id === "oee" ? "md:col-span-2 xl:col-span-1" : ""
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2 pl-1">
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {card.title}
                    <span title={card.hint}>
                      <CircleHelp className="h-3.5 w-3.5" />
                    </span>
                  </p>
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.iconWrap}`}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 pl-1 text-2xl font-semibold tracking-tight text-zinc-900">
                  {kpiDisplayValue(card.id)}
                </p>
                <p className="mt-1 pl-1 text-xs text-zinc-500">{kpiSubtitle(card.id)}</p>
              </section>
            );
          })}
        </div>
      )}
      </DashboardSortableBlock>

      {showLists && (
        <DashboardSortableBlock {...sortableBlockProps("lists")}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="flex min-h-[16rem] flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <ListTodo className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Tareas</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Pendientes y en progreso
                  </p>
                </div>
              </div>
              <Link
                href="/tareas"
                className="shrink-0 text-sm font-medium text-primary-600 hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Cargando tareas">
                <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
                <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
              </div>
            ) : pendingOrders.length === 0 ? (
              <DashboardEmptyState section="tareas" />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col space-y-2">
                <ul className="space-y-2">
                  {pendingOrders.slice(0, pendingVisibleCount).map((order) => (
                    <li
                      key={order.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/tareas/${order.id}`} className="font-medium text-zinc-900 hover:text-primary-600">
                            {order.title}
                          </Link>
                          <span
                            className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${workOrderKindBadgeClass(
                              parseWorkOrderKind(order.kind)
                            )}`}
                          >
                            {workOrderKindLabel(parseWorkOrderKind(order.kind))}
                          </span>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={workOrderStatusBadgeStyle(order.status, statusColors)}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">Vence: {formatDate(order.dueDate)}</span>
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                          {renderPriorityIcon(order.priority)}
                          <span>{priorityLabelEs[order.priority]}</span>
                        </span>
                      </div>
                      {order.assetName && (
                        <p className="mt-1 text-xs text-zinc-500">Activo: {order.assetName}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {pendingVisibleCount < pendingOrders.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingVisibleCount((n) => n + LIST_PAGE_SIZE)
                    }
                    className="mt-auto rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cargar 5 más
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <section className="flex min-h-[16rem] flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <CalendarClock className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Eventos del calendario
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Próximas programaciones
                  </p>
                </div>
              </div>
              <Link
                href="/calendario"
                className="shrink-0 text-sm font-medium text-primary-600 hover:underline"
              >
                Ver calendario
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Cargando eventos">
                <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
                <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <DashboardEmptyState section="eventos" />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col space-y-2">
                <ul className="space-y-2">
                  {upcomingEvents.slice(0, eventsVisibleCount).map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 font-medium text-zinc-900">
                          {event.name}
                        </p>
                        <p className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          {formatDate(event.nextRunAt)}
                        </p>
                      </div>
                      {event.assetName && (
                        <p className="mt-1 text-xs text-zinc-500">Activo: {event.assetName}</p>
                      )}
                      {event.assigneeName && (
                        <p className="mt-1 text-xs text-zinc-500">Asignado: {event.assigneeName}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {eventsVisibleCount < upcomingEvents.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEventsVisibleCount((n) => n + LIST_PAGE_SIZE)
                    }
                    className="mt-auto rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cargar 5 más
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </div>
        </DashboardSortableBlock>
      )}

      <DashboardSortableBlock {...sortableBlockProps("checklists")}>
      <DashboardChecklistsSection />
      </DashboardSortableBlock>

      <DashboardSortableBlock {...sortableBlockProps("charts")}>
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <BarChart3 className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
        Arrastra las tarjetas para reordenar. Los gráficos se guardan aquí desde la página de analíticas.
      </p>

      {widgets.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-zinc-700">Auto-actualización de gráficos</span>
          <button
            type="button"
            role="switch"
            aria-checked={chartAutoRefresh}
            aria-label={
              chartAutoRefresh
                ? "Desactivar auto-actualización cada 30 segundos"
                : "Activar auto-actualización cada 30 segundos"
            }
            onClick={() => {
              const next = !chartAutoRefresh;
              setChartAutoRefresh(next);
              try {
                localStorage.setItem(CHART_AUTO_REFRESH_KEY, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              chartAutoRefresh ? "bg-primary-600" : "bg-zinc-300"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                chartAutoRefresh ? "translate-x-[1.375rem]" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-xs text-zinc-500">
            {chartAutoRefresh ? "Cada 30 s" : "Desactivada"}
          </span>
        </div>
      )}

      {widgets.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 border-dashed bg-zinc-50 p-12 text-center">
          <p className="text-zinc-600 mb-2">Aún no hay gráficos en el dashboard</p>
          <Link
            href="/analytics"
            className="text-primary-600 font-medium hover:underline"
          >
            Ir a Analíticas y añadir uno
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-max">
          {widgets.map((w, index) => (
            <div
              key={w.id}
              draggable
              onDragStart={(e) => handleDragStart(e, w.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative rounded-lg border-2 bg-white transition-colors ${
                draggedId === w.id
                  ? "opacity-50 border-primary-300"
                  : editingWidgetId === w.id
                    ? "border-primary-500 ring-1 ring-primary-200"
                    : dropIndex === index && draggedId !== w.id
                      ? "border-primary-400 bg-primary-50/50"
                      : "border-zinc-200"
              } ${
                (widgetSizes[w.id] ?? "md") === "lg"
                  ? "md:col-span-2 xl:col-span-4"
                  : (widgetSizes[w.id] ?? "md") === "sm"
                    ? "md:col-span-1 xl:col-span-1"
                    : "md:col-span-1 xl:col-span-2"
              }`}
            >
              
              <div className="flex items-center justify-between gap-2 p-2 border-b border-zinc-100 bg-zinc-50/80 rounded-t-lg cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1.5 text-zinc-500" title="Arrastrar para reordenar">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1">
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onPointerDown={stopWidgetDrag}
                      onMouseDown={stopWidgetDrag}
                      onClick={() => setWidgetSize(w.id, size)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        (widgetSizes[w.id] ?? "md") === size
                          ? "bg-primary-600 text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                      aria-label={`Tamaño ${size.toUpperCase()}`}
                      title={`Tamaño ${size.toUpperCase()}`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onPointerDown={stopWidgetDrag}
                    onMouseDown={stopWidgetDrag}
                    onClick={() =>
                      setEditingWidgetId((cur) => (cur === w.id ? null : w.id))
                    }
                    className={`rounded-lg p-1.5 ${
                      editingWidgetId === w.id
                        ? "bg-primary-600 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    }`}
                    aria-pressed={editingWidgetId === w.id}
                    aria-label={
                      editingWidgetId === w.id ? "Terminar edición" : "Editar gráfico"
                    }
                    title={editingWidgetId === w.id ? "Terminar edición" : "Editar gráfico"}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopWidgetDrag}
                    onMouseDown={stopWidgetDrag}
                    onClick={() => setWidgetDeleteConfirmId(w.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Quitar del dashboard"
                    title="Quitar del dashboard"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <AnalyticsChartCard
                  widgetId={w.id}
                  editMode={editingWidgetId === w.id}
                  initialChartType={w.chartType}
                  initialThresholds={w.thresholds}
                  initialAxisLimits={w.axisLimits}
                  templateId={w.templateId}
                  templateName={w.templateName}
                  fieldLabel={w.fieldLabel}
                  fieldLabels={w.fieldLabels}
                  dateFrom={range.from}
                  dateTo={range.to}
                  title={w.chartTitle ?? undefined}
                  size={widgetSizes[w.id] ?? "md"}
                  refreshIntervalMs={
                    chartAutoRefresh ? CHART_REFRESH_INTERVAL_MS : undefined
                  }
                  onSettingsChange={(patch) => patchWidget(w.id, patch)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </DashboardSortableBlock>
      </div>

      <ConfirmDialog
        open={widgetDeleteConfirmId != null}
        title="Quitar gráfico"
        message="¿Quitar este gráfico del dashboard? Esta acción no se puede deshacer."
        confirmLabel="Quitar"
        onConfirm={() => void confirmRemoveWidget()}
        onCancel={() => {
          if (!widgetDeleteLoading) setWidgetDeleteConfirmId(null);
        }}
        loading={widgetDeleteLoading}
      />
    </div>
  );
}
