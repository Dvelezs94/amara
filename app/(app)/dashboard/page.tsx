"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GripVertical, Trash2, BarChart2 } from "lucide-react";
import { AnalyticsChartCard } from "@/components/AnalyticsChartCard";

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
};

type UpcomingEvent = {
  id: string;
  name: string;
  nextRunAt: string | null;
  assetName: string | null;
  assigneeName: string | null;
};

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [widgetSizes, setWidgetSizes] = useState<Record<string, "sm" | "md" | "lg">>({});
  const WIDGET_SIZE_KEY = "dashboard-widget-sizes-v1";

  function loadWidgets() {
    setLoading(true);
    fetch("/api/dashboard/widgets")
      .then((r) => r.json())
      .then((list) => setWidgets(Array.isArray(list) ? list : []))
      .catch(() => setWidgets([]))
      .finally(() => setLoading(false));
  }

  function loadOverview() {
    fetch("/api/dashboard/overview")
      .then((r) => r.json())
      .then((data) => {
        setPendingOrders(Array.isArray(data?.pendingOrders) ? data.pendingOrders : []);
        setUpcomingEvents(Array.isArray(data?.upcomingEvents) ? data.upcomingEvents : []);
      })
      .catch(() => {
        setPendingOrders([]);
        setUpcomingEvents([]);
      });
  }

  useEffect(() => {
    loadWidgets();
    loadOverview();
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
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 text-white py-2.5 px-4 text-sm font-medium"
        >
          <BarChart2 className="h-4 w-4" />
          Añadir gráfico desde analíticas
        </Link>
      </div>
      <p className="text-sm text-zinc-500">
        Arrastra las tarjetas para reordenar. Los gráficos se guardan aquí desde la página de analíticas.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Órdenes pendientes</h2>
            <Link href="/work-orders" className="text-sm font-medium text-primary-600 hover:underline">
              Ver todas
            </Link>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay órdenes pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {pendingOrders.map((order) => (
                <li key={order.id} className="rounded-lg border border-zinc-100 bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/work-orders/${order.id}`} className="font-medium text-zinc-900 hover:text-primary-600">
                      {order.title}
                    </Link>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
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

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
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
                <li key={event.id} className="rounded-lg border border-zinc-100 bg-surface p-3">
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

      {widgets.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed bg-zinc-50 p-12 text-center">
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
              className={`relative rounded-xl border-2 bg-white transition-colors ${
                draggedId === w.id
                  ? "opacity-50 border-primary-300"
                  : dropIndex === index && draggedId !== w.id
                    ? "border-primary-400 bg-primary-50/50"
                    : "border-zinc-200"
              } ${
                (widgetSizes[w.id] ?? "md") === "lg"
                  ? "md:col-span-2 xl:col-span-2"
                  : (widgetSizes[w.id] ?? "md") === "sm"
                    ? "md:col-span-1 xl:col-span-1"
                    : "md:col-span-1 xl:col-span-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2 p-2 border-b border-zinc-100 bg-zinc-50/80 rounded-t-xl cursor-grab active:cursor-grabbing">
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
                  dateFrom={w.dateFrom}
                  dateTo={w.dateTo}
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
