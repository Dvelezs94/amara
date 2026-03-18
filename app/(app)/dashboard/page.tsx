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

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function loadWidgets() {
    setLoading(true);
    fetch("/api/dashboard/widgets")
      .then((r) => r.json())
      .then((list) => setWidgets(Array.isArray(list) ? list : []))
      .catch(() => setWidgets([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadWidgets();
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              }`}
            >
              <div className="flex items-center justify-between gap-2 p-2 border-b border-zinc-100 bg-zinc-50/80 rounded-t-xl cursor-grab active:cursor-grabbing">
                <span className="flex items-center gap-1.5 text-zinc-500" title="Arrastrar para reordenar">
                  <GripVertical className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  onClick={() => removeWidget(w.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50"
                  aria-label="Quitar del dashboard"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3">
                <AnalyticsChartCard
                  templateId={w.templateId}
                  templateName={w.templateName}
                  fieldLabel={w.fieldLabel}
                  dateFrom={w.dateFrom}
                  dateTo={w.dateTo}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
