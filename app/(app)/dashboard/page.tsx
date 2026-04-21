"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, Trash2, Plus, CircleHelp, CalendarDays } from "lucide-react";
import { AnalyticsChartCard } from "@/components/AnalyticsChartCard";
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

type Widget = {
  id: string;
  templateId: string;
  templateName: string;
  fieldLabel: string;
  dateFrom: string | null;
  dateTo: string | null;
  sortOrder: number;
};

type PendingOrder = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
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

const statusColors: Record<PendingOrder["status"], string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
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

  const showLists = isDefaultLast30DaysRange(range);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIDGET_SIZE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, "sm" | "md" | "lg">;
        setWidgetSizes(parsed ?? {});
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
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function statusLabel(status: PendingOrder["status"]) {
    if (status === "open") return "Abierta";
    if (status === "in_progress") return "En progreso";
    if (status === "completed") return "Completada";
    return "Cancelada";
  }

  function formatKpiValue(
    value: number | null | undefined,
    suffix = ""
  ) {
    if (value == null || Number.isNaN(value)) return "—";
    return `${value}${suffix}`;
  }

  async function removeWidget(id: string) {
    await fetch(`/api/dashboard/widgets/${id}`, { method: "DELETE" });
    setWidgets((prev) => prev.filter((w) => w.id !== id));
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
        <h1 className="text-3xl font-bold uppercase tracking-tight text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold uppercase leading-none text-zinc-900">Dashboard</h1>
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
            className="inline-flex items-center gap-2 rounded-md border border-transparent bg-primary-600 py-2.5 px-4 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Añadir gráfico
          </Link>
        </div>
      </div>

      <DashboardDateRangeModal
        open={rangeModalOpen}
        onOpenChange={setRangeModalOpen}
        value={range}
        onApply={setRange}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <span title="Horas de inactividad: suma de horas de órdenes completadas en la ventana de tiempo.">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatKpiValue(kpis?.downtimeHours, " h")}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Horas de parada acumuladas ({kpis?.windowDays ?? 30} días)</p>
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
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
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
              <h2 className="text-sm font-semibold text-zinc-900">Tareas pendientes</h2>
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
                    <p className="mt-1 text-xs text-zinc-500">
                      Prioridad: {order.priority} · Vence: {formatDate(order.dueDate)}
                    </p>
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
                    onClick={() => removeWidget(w.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Quitar del dashboard"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <AnalyticsChartCard
                  templateId={w.templateId}
                  templateName={w.templateName}
                  fieldLabel={w.fieldLabel}
                  dateFrom={range.from}
                  dateTo={range.to}
                  size={widgetSizes[w.id] ?? "md"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
