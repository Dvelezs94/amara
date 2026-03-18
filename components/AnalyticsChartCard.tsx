"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type ChecklistItem = {
  label: string;
  type: string;
  fieldType: string | null;
  value: unknown;
};
type WorkOrderData = {
  id: string;
  completedAt: string | null;
  checklistItems: ChecklistItem[];
};
type ApiResponse = {
  templateId: string;
  templateName: string;
  workOrders: WorkOrderData[];
  fields: string[];
};

export function AnalyticsChartCard({
  templateId,
  templateName,
  fieldLabel,
  dateFrom,
  dateTo,
  title,
}: {
  templateId: string;
  templateName: string;
  fieldLabel: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  title?: string;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ templateId });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    fetch(`/api/analytics/checklist-data?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [templateId, dateFrom, dateTo]);

  const selectedField =
    data?.workOrders?.flatMap((wo) =>
      (wo.checklistItems ?? []).filter((i) => i.label === fieldLabel)
    ) ?? [];
  const fieldType = selectedField[0]?.fieldType ?? null;

  let chartData: { name: string; value: number }[] = [];
  let lineData: { date: string; value: number; count: number }[] = [];
  if (fieldLabel && data?.workOrders) {
    if (fieldType === "number") {
      const byDate = new Map<string, { sum: number; count: number }>();
      for (const wo of data.workOrders) {
        const item = wo.checklistItems.find((i) => i.label === fieldLabel);
        const val = item?.value != null ? Number(item.value) : null;
        if (val === null || Number.isNaN(val)) continue;
        const dateStr = wo.completedAt
          ? new Date(wo.completedAt).toLocaleDateString("es")
          : "—";
        const cur = byDate.get(dateStr) ?? { sum: 0, count: 0 };
        cur.sum += val;
        cur.count += 1;
        byDate.set(dateStr, cur);
      }
      lineData = Array.from(byDate.entries())
        .map(([date, { sum, count }]) => ({
          date,
          value: Math.round((sum / count) * 100) / 100,
          count,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (fieldType === "dropdown" || fieldType === "text") {
      const counts = new Map<string, number>();
      for (const item of selectedField) {
        const v = item.value != null ? String(item.value) : "(empty)";
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      chartData = Array.from(counts.entries()).map(([name, value]) => ({
        name: name === "(empty)" ? "(vacío)" : name,
        value,
      }));
    } else if (fieldType === "checkbox") {
      let yes = 0,
        no = 0;
      for (const item of selectedField) {
        if (item.value === true) yes++;
        else no++;
      }
      chartData = [
        { name: "Sí", value: yes },
        { name: "No", value: no },
      ];
    }
  }

  const displayTitle = title ?? `${templateName} — ${fieldLabel}`;

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 h-80 flex items-center justify-center text-zinc-500">
        Cargando…
      </div>
    );
  }
  if (!data?.workOrders?.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 h-80 flex items-center justify-center text-zinc-500 text-sm">
        Sin datos en el rango seleccionado
      </div>
    );
  }
  if (!fieldType) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 h-80 flex items-center justify-center text-zinc-500 text-sm">
        Campo no encontrado
      </div>
    );
  }

  if (fieldType === "number" && lineData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          {fieldLabel} en el tiempo (promedio por día)
        </h2>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} name={fieldLabel} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if ((fieldType === "dropdown" || fieldType === "text") && chartData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700 mb-2">{fieldLabel} — distribución</h2>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" name="Cantidad" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (fieldType === "checkbox" && (chartData[0]?.value > 0 || chartData[1]?.value > 0)) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700 mb-2">{fieldLabel} — sí / no</h2>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (fieldType === "date") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700 mb-2">{fieldLabel}</h2>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <p className="text-zinc-500 text-sm">Campos de fecha: lista. Gráfico próximamente.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {selectedField.slice(0, 5).map((item, i) => (
            <li key={i}>{item.value != null ? String(item.value).slice(0, 10) : "—"}</li>
          ))}
          {selectedField.length > 5 && (
            <li className="text-zinc-400">… y {selectedField.length - 5} más</li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 h-80 flex items-center justify-center text-zinc-500 text-sm">
      Sin datos para este campo
    </div>
  );
}
