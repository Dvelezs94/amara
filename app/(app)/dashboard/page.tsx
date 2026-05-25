"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import Link from "next/link";
import {
  GripVertical,
  Trash2,
  Plus,
  CircleHelp,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Equal,
  Minus,
  Pencil,
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
import { defaultLast30DaysRange, isDefaultLast30DaysRange } from "@/lib/dashboard-date-range";
import { APP_TIME_ZONE } from "@/lib/timezone";

type Widget = {
  id: string;
  templateId: string;
  templateName: string;
  fieldLabel: string;
  /** Múltiples campos del mismo tipo para un mismo gráfico */
  fieldLabels?: string[];
  chartType?: "line" | "bar" | "pie" | string;
  thresholds?: { id: string; value: number; label?: string; color?: string }[];
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

const statusColors: Record<PendingOrder["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

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
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => defaultLast30DaysRange());
  const initialFetchDone = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const WIDGET_SIZE_KEY = "dashboard-widget-sizes-v1";
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [chartAutoRefresh, setChartAutoRefresh] = useState(true);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [widgetDeleteConfirmId, setWidgetDeleteConfirmId] = useState<string | null>(null);
  const [widgetDeleteLoading, setWidgetDeleteLoading] = useState(false);

  const showLists = isDefaultLast30DaysRange(range);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRangeModalOpen(true)}
            className="inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-300 bg-white py-2.5 pl-3 pr-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 sm:pr-4"
            aria-label="Cambiar rango de fechas"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
            <span className="hidden truncate sm:inline">{formatDashboardRangeTrigger(range)}</span>
            <span className="sm:hidden">Fechas</span>
          </button>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-md border border-transparent bg-primary-600 py-2.5 pl-3 pr-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700 sm:px-4 sm:font-semibold sm:uppercase sm:tracking-[0.08em]"
          >
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">Gráfico</span>
            <span className="hidden sm:inline">Añadir gráfico</span>
          </Link>
        </div>
      </div>

      <DashboardDateRangeModal
        open={rangeModalOpen}
        onOpenChange={setRangeModalOpen}
        value={range}
        onApply={setRange}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            MTTR
            <span title="Tiempo medio de reparación: promedio de horas desde creación hasta finalización de órdenes completadas.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.mttrHours, " h")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Tiempo medio de reparación ({kpis?.windowDays ?? 30} días)</p>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Inactividad
            <span title="Suma de horas (creación → cierre) de órdenes completadas en la ventana; no es el paro de máquina medido en tareas.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.downtimeHours, " h")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Horas ciclo creación–cierre ({kpis?.windowDays ?? 30} días)</p>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Paro de máquina
            <span title="Suma del tiempo en curso hasta terminada más paro manual, solo en tareas marcadas con paro y en máquinas con seguimiento activado.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.machineDowntimeHours, " h")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">En ventana de {kpis?.windowDays ?? 30} días (por fecha de creación)</p>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Planificado vs no planificado
            <span title="Planificado = tareas rutinarias (calendario). No planificado = órdenes bajo demanda. Sobre tareas creadas en la ventana.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.plannedPct, "%")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Planificado {kpis?.plannedCount ?? 0} · No planificado {kpis?.unplannedCount ?? 0}
          </p>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4 md:col-span-2 xl:col-span-1">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            OEE
            <span title="Eficiencia global del equipo estimada con base en disponibilidad (1 - inactividad / horas disponibles).">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.oee, "%")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Estimado por disponibilidad en ventana de {kpis?.windowDays ?? 30} días</p>
        </section>
      </div>

      {showLists && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">Tareas</h2>
              <Link href="/tareas" className="text-sm font-medium text-primary-600 hover:underline">
                Ver todas
              </Link>
            </div>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay tareas pendientes.</p>
            ) : (
              <ul className="space-y-2">
                {pendingOrders.map((order) => (
                  <li key={order.id} className="rounded-md border border-zinc-100 bg-surface p-3">
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
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[order.status]
                        }`}
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
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">Próximos eventos</h2>
              <Link href="/calendario" className="text-sm font-medium text-primary-600 hover:underline">
                Ver calendario
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay eventos próximos.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="rounded-md border border-zinc-100 bg-surface p-3">
                    <p className="font-medium text-zinc-900">{event.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Fecha: {formatDate(event.nextRunAt)}
                    </p>
                    {event.assetName && (
                      <p className="mt-1 text-xs text-zinc-500">Activo: {event.assetName}</p>
                    )}
                    {event.assigneeName && (
                      <p className="mt-1 text-xs text-zinc-500">Asignado: {event.assigneeName}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <p className="text-sm text-zinc-500">
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
                  templateId={w.templateId}
                  templateName={w.templateName}
                  fieldLabel={w.fieldLabel}
                  fieldLabels={w.fieldLabels}
                  dateFrom={range.from}
                  dateTo={range.to}
                  title={w.chartTitle}
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
