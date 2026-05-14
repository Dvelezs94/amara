"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  buildMultiCategoricalUnion,
  buildMultiCheckboxBars,
  buildMultiNumberTimeData,
  commonFieldType,
  normalizeWidgetFieldLabels,
} from "@/lib/analytics-checklist-multi-chart";
import {
  clampWidgetChartType,
  type DashboardWidgetChartType,
} from "@/lib/dashboard-widget-chart-type";

const COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

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

const MIN_REFRESH_MS = 5_000;

export function AnalyticsChartCard({
  widgetId,
  initialChartType,
  templateId,
  templateName,
  fieldLabel,
  fieldLabels,
  dateFrom,
  dateTo,
  title,
  size = "md",
  refreshIntervalMs,
}: {
  /** Si se define, los cambios de tipo de gráfico se guardan en el widget del dashboard. */
  widgetId?: string;
  /** Preferencia guardada (`dashboard_widgets.chart_type`). */
  initialChartType?: string | null;
  templateId: string;
  templateName: string;
  fieldLabel: string;
  /** Varias etiquetas del mismo tipo (compat. con widgets guardados solo con `fieldLabel`). */
  fieldLabels?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  title?: string;
  size?: "sm" | "md" | "lg";
  /** Polling interval for checklist data; omit or use values below 5000 ms to disable. */
  refreshIntervalMs?: number;
}) {
  const selectedLabels = useMemo(
    () => normalizeWidgetFieldLabels(fieldLabel, fieldLabels),
    [fieldLabel, fieldLabels]
  );

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<DashboardWidgetChartType>("line");
  const chartHeightClass =
    size === "lg" ? "h-80 md:h-96" : size === "sm" ? "h-44 md:h-52" : "h-56 md:h-64";
  const emptyHeightClass = size === "lg" ? "h-[26rem]" : size === "sm" ? "h-60" : "h-80";

  const load = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const params = new URLSearchParams({ templateId });
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);
        const r = await fetch(`/api/analytics/checklist-data?${params}`);
        const json = (await r.json()) as ApiResponse;
        setData(json);
      } catch {
        setData(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [templateId, dateFrom, dateTo]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < MIN_REFRESH_MS) return;
    const id = window.setInterval(() => {
      void load(false);
    }, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refreshIntervalMs, load]);

  const workOrders = data?.workOrders ?? [];

  const fieldType = useMemo(
    () =>
      selectedLabels.length > 0 ? commonFieldType(workOrders, selectedLabels) : null,
    [workOrders, selectedLabels]
  );

  const selectedFieldItems = useMemo(
    () =>
      workOrders.flatMap((wo) =>
        (wo.checklistItems ?? []).filter((i) => selectedLabels.includes(i.label))
      ),
    [workOrders, selectedLabels]
  );

  const multiNumber = useMemo(() => {
    if (fieldType !== "number" || selectedLabels.length === 0) return null;
    return buildMultiNumberTimeData(workOrders, selectedLabels, APP_TIME_ZONE);
  }, [fieldType, workOrders, selectedLabels]);

  const singleCategoricalChartData = useMemo(() => {
    if ((fieldType !== "dropdown" && fieldType !== "text") || selectedLabels.length !== 1) {
      return [];
    }
    const label = selectedLabels[0]!;
    const counts = new Map<string, number>();
    for (const wo of workOrders) {
      const item = wo.checklistItems.find((i) => i.label === label);
      if (!item) continue;
      const v = item.value != null ? String(item.value) : "(empty)";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({
      name: name === "(empty)" ? "(vacío)" : name,
      value,
    }));
  }, [fieldType, workOrders, selectedLabels]);

  const multiCategorical = useMemo(() => {
    if ((fieldType !== "dropdown" && fieldType !== "text") || selectedLabels.length <= 1) {
      return null;
    }
    return buildMultiCategoricalUnion(workOrders, selectedLabels);
  }, [fieldType, workOrders, selectedLabels]);

  const singleCheckboxChartData = useMemo(() => {
    if (fieldType !== "checkbox" || selectedLabels.length !== 1) return [];
    const label = selectedLabels[0]!;
    let yes = 0;
    let no = 0;
    for (const wo of workOrders) {
      const item = wo.checklistItems.find((i) => i.label === label);
      if (!item) continue;
      if (item.value === true) yes++;
      else no++;
    }
    return [
      { name: "Sí", value: yes },
      { name: "No", value: no },
    ];
  }, [fieldType, workOrders, selectedLabels]);

  const multiCheckboxBars = useMemo(() => {
    if (fieldType !== "checkbox" || selectedLabels.length <= 1) return [];
    return buildMultiCheckboxBars(workOrders, selectedLabels);
  }, [fieldType, workOrders, selectedLabels]);

  const persistWidgetChartType = useCallback(
    (next: DashboardWidgetChartType) => {
      if (!widgetId) return;
      void fetch(`/api/dashboard/widgets/${widgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartType: next }),
      });
    },
    [widgetId]
  );

  useEffect(() => {
    if (!fieldType) return;
    setChartType(clampWidgetChartType(initialChartType, fieldType, selectedLabels.length));
  }, [fieldType, selectedLabels.join("|"), initialChartType]);

  const labelsTitle = selectedLabels.join(", ");
  const displayTitle = title ?? `${templateName} — ${labelsTitle}`;

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

  if (fieldType === "number" && multiNumber && multiNumber.data.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">
            {labelsTitle} en el tiempo (punto por registro)
          </h2>
          <select
            value={chartType}
            onChange={(e) => {
              const next = e.target.value as "line" | "bar";
              setChartType(next);
              persistWidgetChartType(next);
            }}
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
              <BarChart data={multiNumber.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {multiNumber.series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    fill={COLORS[i % COLORS.length]}
                    name={s.name}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={multiNumber.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {multiNumber.series.map((s, i) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    name={s.name}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }

  if (multiCategorical && multiCategorical.data.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{labelsTitle} — comparación</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className={chartHeightClass}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={multiCategorical.data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {multiCategorical.series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={COLORS[i % COLORS.length]}
                  name={s.name}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if ((fieldType === "dropdown" || fieldType === "text") && singleCategoricalChartData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{labelsTitle} — distribución</h2>
          <select
            value={chartType}
            onChange={(e) => {
              const next = e.target.value as "bar" | "pie";
              setChartType(next);
              persistWidgetChartType(next);
            }}
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
                <Pie
                  data={singleCategoricalChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                >
                  {singleCategoricalChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={singleCategoricalChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F14C03" name="Cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  }

  if (
    fieldType === "checkbox" &&
    selectedLabels.length > 1 &&
    multiCheckboxBars.some((r) => r.sí + r.no > 0)
  ) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{labelsTitle} — sí / no por campo</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <div className={chartHeightClass}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={multiCheckboxBars} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sí" fill="#02257D" name="Sí" radius={[4, 4, 0, 0]} />
              <Bar dataKey="no" fill="#9E9F9F" name="No" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (
    fieldType === "checkbox" &&
    selectedLabels.length === 1 &&
    (singleCheckboxChartData[0]?.value > 0 || singleCheckboxChartData[1]?.value > 0)
  ) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-700">{labelsTitle} — sí / no</h2>
          <select
            value={chartType}
            onChange={(e) => {
              const next = e.target.value as "bar" | "pie";
              setChartType(next);
              persistWidgetChartType(next);
            }}
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
              <BarChart data={singleCheckboxChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F14C03" name="Cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={singleCheckboxChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                >
                  {singleCheckboxChartData.map((_, i) => (
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
        <h2 className="text-sm font-medium text-zinc-700 mb-2">{labelsTitle}</h2>
        <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
        <p className="text-zinc-500 text-sm">Campos de fecha: lista. Gráfico próximamente.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {selectedFieldItems.slice(0, 5).map((item, i) => (
            <li key={i}>
              <span className="text-zinc-500">{item.label}: </span>
              {item.value != null ? String(item.value).slice(0, 10) : "—"}
            </li>
          ))}
          {selectedFieldItems.length > 5 && (
            <li className="text-zinc-400">… y {selectedFieldItems.length - 5} más</li>
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
