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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { NumberTimeSeriesChart } from "@/components/NumberTimeSeriesChart";
import { CategoricalDailyStackedChart } from "@/components/CategoricalDailyStackedChart";
import { ChartThresholdEditor } from "@/components/ChartThresholdEditor";
import { EditableChartTitle } from "@/components/EditableChartTitle";
import {
  buildDefaultAnalyticsChartTitle,
  inferAnalyticsChartTitlePreset,
} from "@/lib/analytics-chart-title";
import {
  parseChartThresholds,
  type ChartThreshold,
} from "@/lib/chart-thresholds";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  buildCategoricalDailyTimeData,
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
  initialThresholds,
  templateId,
  templateName,
  fieldLabel,
  fieldLabels,
  dateFrom,
  dateTo,
  title,
  size = "md",
  refreshIntervalMs,
  editMode: editModeProp,
  onSettingsChange,
}: {
  /** Si se define, los cambios de tipo de gráfico se guardan en el widget del dashboard. */
  widgetId?: string;
  /** En dashboard: false = solo gráfico; true = título, umbrales y tipo editables. */
  editMode?: boolean;
  /** Sincroniza estado local del widget tras guardar (dashboard). */
  onSettingsChange?: (patch: {
    chartTitle?: string | null;
    chartType?: DashboardWidgetChartType;
    thresholds?: ChartThreshold[];
  }) => void;
  /** Preferencia guardada (`dashboard_widgets.chart_type`). */
  initialChartType?: string | null;
  /** Umbrales guardados (`dashboard_widgets.thresholds`). */
  initialThresholds?: ChartThreshold[] | null;
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

  const editMode = editModeProp ?? widgetId == null;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<DashboardWidgetChartType>("line");
  const [thresholds, setThresholds] = useState<ChartThreshold[]>(() =>
    parseChartThresholds(initialThresholds ?? [])
  );
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

  const categoricalDaily = useMemo(() => {
    if ((fieldType !== "dropdown" && fieldType !== "text") || selectedLabels.length !== 1) {
      return null;
    }
    return buildCategoricalDailyTimeData(workOrders, selectedLabels[0]!, APP_TIME_ZONE);
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

  const persistWidgetSettings = useCallback(
    (patch: {
      chartType?: DashboardWidgetChartType;
      thresholds?: ChartThreshold[];
      chartTitle?: string | null;
    }) => {
      if (!widgetId) return;
      onSettingsChange?.(patch);
      void fetch(`/api/dashboard/widgets/${widgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [widgetId, onSettingsChange]
  );

  useEffect(() => {
    if (!fieldType) return;
    setChartType(clampWidgetChartType(initialChartType, fieldType, selectedLabels.length));
  }, [fieldType, selectedLabels.join("|"), initialChartType]);

  useEffect(() => {
    setThresholds(parseChartThresholds(initialThresholds ?? []));
  }, [widgetId, JSON.stringify(initialThresholds ?? [])]);

  const labelsTitle = selectedLabels.join(", ");
  const displayTitle = `${templateName} — ${labelsTitle}`;

  const defaultChartTitle = useMemo(() => {
    const preset = inferAnalyticsChartTitlePreset(
      fieldType,
      selectedLabels.length,
      chartType
    );
    if (!preset) return displayTitle;
    return buildDefaultAnalyticsChartTitle(selectedLabels, preset);
  }, [fieldType, selectedLabels, chartType, displayTitle]);

  const [chartTitle, setChartTitle] = useState(defaultChartTitle);

  useEffect(() => {
    setChartTitle(title?.trim() || defaultChartTitle);
  }, [widgetId, title, defaultChartTitle]);

  const commitChartTitle = useCallback(
    (next: string) => {
      if (!widgetId) return;
      const trimmed = next.trim().slice(0, 200);
      persistWidgetSettings({
        chartTitle: trimmed && trimmed !== defaultChartTitle ? trimmed : null,
      });
    },
    [widgetId, defaultChartTitle, persistWidgetSettings]
  );

  const titleControl = editMode ? (
    <EditableChartTitle
      value={chartTitle}
      onChange={setChartTitle}
      onCommit={widgetId ? commitChartTitle : undefined}
      className="mb-0 min-w-0 flex-1"
    />
  ) : (
    <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800" title={chartTitle}>
      {chartTitle}
    </h2>
  );

  const metaLine = (
    <p className="text-xs text-zinc-400 mb-1">{displayTitle}</p>
  );

  const editHint =
    widgetId && editMode ? (
      <p className="mb-2 text-[11px] text-zinc-500 leading-snug">
        El rango de fechas sigue el selector del dashboard. Para cambiar plantilla o campos, añade un
        gráfico nuevo en{" "}
        <a href="/analytics" className="font-medium text-primary-600 hover:underline">
          Analíticas
        </a>
        .
      </p>
    ) : null;

  const numericChartTypeSelect = (value: "line" | "bar") =>
    editMode ? (
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as "line" | "bar";
          setChartType(next);
          persistWidgetSettings({ chartType: next });
        }}
        className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
      >
        <option value="line">Línea</option>
        <option value="bar">Barras</option>
      </select>
    ) : null;

  const categoricalSingleChartTypeSelect = (
    <select
      value={chartType}
      onChange={(e) => {
        const next = e.target.value as DashboardWidgetChartType;
        setChartType(next);
        persistWidgetSettings({ chartType: next });
      }}
      className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
    >
      <option value="stacked">Por día</option>
      <option value="bar">Distribución (barras)</option>
      <option value="pie">Distribución (pastel)</option>
    </select>
  );

  const checkboxChartTypeSelect = (
    <select
      value={chartType}
      onChange={(e) => {
        const next = e.target.value as "bar" | "pie";
        setChartType(next);
        persistWidgetSettings({ chartType: next });
      }}
      className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
    >
      <option value="pie">Pastel</option>
      <option value="bar">Barras</option>
    </select>
  );

  const thresholdEditor =
    editMode && fieldType === "number" ? (
      <ChartThresholdEditor
        compact
        thresholds={thresholds}
        onChange={(next) => {
          setThresholds(next);
          persistWidgetSettings({ thresholds: next });
        }}
      />
    ) : null;

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
    const numericChartType = chartType === "bar" ? "bar" : "line";
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {titleControl}
          {numericChartTypeSelect(numericChartType)}
        </div>
        {editMode ? editHint : null}
        {editMode ? metaLine : (
          <p className="mb-1 truncate text-[10px] text-zinc-400">{displayTitle}</p>
        )}
        {thresholdEditor}
        <div className={`${chartHeightClass} ${editMode ? "mt-3" : "mt-0"}`}>
          <NumberTimeSeriesChart
            data={multiNumber.data}
            series={multiNumber.series}
            chartType={numericChartType}
            thresholds={thresholds}
            colors={COLORS}
            tickFontSize={11}
          />
        </div>
      </div>
    );
  }

  if (multiCategorical && multiCategorical.data.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">{titleControl}</div>
        {editMode ? editHint : null}
        {editMode ? metaLine : null}
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

  if (
    (fieldType === "dropdown" || fieldType === "text") &&
    chartType === "stacked" &&
    categoricalDaily &&
    categoricalDaily.data.length > 0
  ) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          {titleControl}
          {editMode ? categoricalSingleChartTypeSelect : null}
        </div>
        {editMode ? editHint : null}
        {editMode ? metaLine : null}
        <div className={chartHeightClass}>
          <CategoricalDailyStackedChart
            data={categoricalDaily.data}
            series={categoricalDaily.series}
            colors={COLORS}
            tickFontSize={11}
          />
        </div>
      </div>
    );
  }

  if ((fieldType === "dropdown" || fieldType === "text") && singleCategoricalChartData.length > 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          {titleControl}
          {editMode ? categoricalSingleChartTypeSelect : null}
        </div>
        {editMode ? editHint : null}
        {editMode ? metaLine : null}
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
        <div className="mb-2 flex items-center justify-between gap-2">{titleControl}</div>
        {editMode ? editHint : null}
        {editMode ? metaLine : null}
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
          {titleControl}
          {editMode ? checkboxChartTypeSelect : null}
        </div>
        {editMode ? editHint : null}
        {editMode ? metaLine : null}
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
        {titleControl}
        {editMode ? editHint : null}
        {editMode ? <p className="text-xs text-zinc-400 mb-1 mt-2">{displayTitle}</p> : null}
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
