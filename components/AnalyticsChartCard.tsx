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

const COLORS = ["#1F3C88", "#F36C21", "#6FAF6F", "#4A4A4A", "#557DDA", "#1A3272"];

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
  size = "md",
}: {
  templateId: string;
  templateName: string;
  fieldLabel: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  title?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"line" | "bar" | "pie">("line");
  const chartHeightClass =
    size === "lg" ? "h-80 md:h-96" : size === "sm" ? "h-44 md:h-52" : "h-56 md:h-64";
  const emptyHeightClass = size === "lg" ? "h-[26rem]" : size === "sm" ? "h-60" : "h-80";

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

  useEffect(() => {
    if (fieldType === "number") {
      setChartType("line");
      return;
    }
    if (fieldType === "checkbox") {
      setChartType("pie");
      return;
    }
    if (fieldType === "dropdown" || fieldType === "text") {
      setChartType("bar");
    }
  }, [fieldType, fieldLabel]);

  let chartData: { name: string; value: number }[] = [];
  let lineData: { ts: number; date: string; value: number }[] = [];
  if (fieldLabel && data?.workOrders) {
    if (fieldType === "number") {
      for (const wo of data.workOrders) {
        const item = wo.checklistItems.find((i) => i.label === fieldLabel);
        const val = item?.value != null ? Number(item.value) : null;
        if (val === null || Number.isNaN(val)) continue;
        const ts = wo.completedAt ? new Date(wo.completedAt).getTime() : NaN;
        if (!Number.isFinite(ts)) continue;
        lineData.push({
          ts,
          date: new Date(ts).toLocaleString("es-MX", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: Math.round(val * 100) / 100,
        });
      }
      lineData = lineData.sort((a, b) => a.ts - b.ts);
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
      <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${emptyHeightClass} flex items-center justify-center text-zinc-500`}>
        Cargando…
      </div>
    );
  }
  if (!data?.workOrders?.length) {
    return (
      <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${emptyHeightClass} flex items-center justify-center text-zinc-500 text-sm`}>
        Sin datos en el rango seleccionado
      </div>
    );
  }
  if (!fieldType) {
    return (
      <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${emptyHeightClass} flex items-center justify-center text-zinc-500 text-sm`}>
        Campo no encontrado
      </div>
    );
  }

  if (fieldType === "number" && lineData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">
            {fieldLabel} en el tiempo (punto por registro)
          </h2>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as "line" | "bar")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
          >
            <option value="line">Línea</option>
            <option value="bar">Barras</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className={chartHeightClass}>
          {chartType === "bar" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1F3C88" name={fieldLabel} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1F3C88"
                  strokeWidth={2}
                  name={fieldLabel}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }

  if ((fieldType === "dropdown" || fieldType === "text") && chartData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{fieldLabel} — distribución</h2>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as "bar" | "pie")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
          >
            <option value="bar">Barras</option>
            <option value="pie">Pastel</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className={chartHeightClass}>
          {chartType === "pie" ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F36C21" name="Cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }

  if (fieldType === "checkbox" && (chartData[0]?.value > 0 || chartData[1]?.value > 0)) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{fieldLabel} — sí / no</h2>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as "bar" | "pie")}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
          >
            <option value="pie">Pastel</option>
            <option value="bar">Barras</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className={chartHeightClass}>
          {chartType === "bar" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F36C21" name="Cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
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
          )}
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
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${emptyHeightClass} flex items-center justify-center text-zinc-500 text-sm`}>
      Sin datos para este campo
    </div>
  );
}
