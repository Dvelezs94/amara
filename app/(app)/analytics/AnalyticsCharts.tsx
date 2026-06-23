"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { NumberTimeSeriesChart } from "@/components/NumberTimeSeriesChart";
import { CategoricalDailyStackedChart } from "@/components/CategoricalDailyStackedChart";
import { ChartThresholdEditor } from "@/components/ChartThresholdEditor";
import { ChartAxisLimitsEditor } from "@/components/ChartAxisLimitsEditor";
import { AnalyticsCountBarChart } from "@/components/AnalyticsCountBarChart";
import { EditableChartTitle } from "@/components/EditableChartTitle";
import {
  analyticsChartTitleStorageKey,
  buildDefaultAnalyticsChartTitle,
  inferAnalyticsChartTitlePreset,
  loadChartTitleFromStorage,
  saveChartTitleToStorage,
} from "@/lib/analytics-chart-title";
import {
  analyticsAxisLimitsStorageKey,
  DEFAULT_CHART_AXIS_LIMITS,
  loadAxisLimitsFromStorage,
  saveAxisLimitsToStorage,
  type ChartAxisLimits,
} from "@/lib/chart-axis-limits";
import {
  analyticsThresholdsStorageKey,
  loadThresholdsFromStorage,
  saveThresholdsToStorage,
  type ChartThreshold,
} from "@/lib/chart-thresholds";
import { LayoutDashboard } from "lucide-react";
import { AnalyticsFieldsPicker } from "@/components/AnalyticsFieldsPicker";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  displayLabelForFieldKey,
  findChecklistItemByFieldKey,
  type AnalyticsFieldDescriptor,
} from "@/lib/analytics-checklist-field-key";
import {
  buildCategoricalDailyTimeData,
  buildMultiCategoricalUnion,
  buildMultiCheckboxBars,
  buildMultiNumberTimeData,
  commonFieldType,
} from "@/lib/analytics-checklist-multi-chart";
import type { DashboardWidgetChartType } from "@/lib/dashboard-widget-chart-type";

type Template = { id: string; name: string };
type ChecklistItem = {
  id: string;
  parentItemId?: string | null;
  label: string;
  type: string;
  fieldType: string | null;
  value: unknown;
};
type WorkOrderData = {
  id: string;
  title: string | null;
  status?: string;
  completedAt: string | null;
  checklistItems: ChecklistItem[];
};
type ApiResponse = {
  templateId: string;
  templateName: string;
  workOrders: WorkOrderData[];
  fields: AnalyticsFieldDescriptor[];
};

const COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

export function AnalyticsCharts() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]);
  const [fieldTypeHint, setFieldTypeHint] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<DashboardWidgetChartType>("line");
  const [addToDashboardStatus, setAddToDashboardStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [thresholds, setThresholds] = useState<ChartThreshold[]>([]);
  const [axisLimits, setAxisLimits] = useState<ChartAxisLimits>(DEFAULT_CHART_AXIS_LIMITS);
  const [chartTitle, setChartTitle] = useState("");

  const axisLimitsStorageKey = useMemo(
    () =>
      templateId && selectedFieldKeys.length > 0
        ? analyticsAxisLimitsStorageKey(templateId, selectedFieldKeys)
        : null,
    [templateId, selectedFieldKeys.join("|")]
  );

  const thresholdsStorageKey = useMemo(
    () =>
      templateId && selectedFieldKeys.length > 0
        ? analyticsThresholdsStorageKey(templateId, selectedFieldKeys)
        : null,
    [templateId, selectedFieldKeys.join("|")]
  );

  useEffect(() => {
    if (!thresholdsStorageKey) {
      setThresholds([]);
      return;
    }
    setThresholds(loadThresholdsFromStorage(thresholdsStorageKey));
  }, [thresholdsStorageKey]);

  useEffect(() => {
    if (!axisLimitsStorageKey) {
      setAxisLimits(DEFAULT_CHART_AXIS_LIMITS);
      return;
    }
    setAxisLimits(loadAxisLimitsFromStorage(axisLimitsStorageKey));
  }, [axisLimitsStorageKey]);

  function updateAxisLimits(next: ChartAxisLimits) {
    setAxisLimits(next);
    if (axisLimitsStorageKey) saveAxisLimitsToStorage(axisLimitsStorageKey, next);
  }

  useEffect(() => {
    setFieldsModalOpen(false);
  }, [templateId]);

  useEffect(() => {
    if (!fieldsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFieldsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fieldsModalOpen]);

  useEffect(() => {
    if (!fieldsModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fieldsModalOpen]);

  useEffect(() => {
    fetch("/api/checklist-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!templateId) {
      setData(null);
      setSelectedFieldKeys([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ templateId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/analytics/checklist-data?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setSelectedFieldKeys((prev) => {
          const fields: AnalyticsFieldDescriptor[] = Array.isArray(d.fields) ? d.fields : [];
          const keys = new Set(fields.map((f) => f.key));
          return prev.filter((x) => keys.has(x));
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [templateId, from, to]);

  const workOrders = data?.workOrders ?? [];

  const selectedDisplayLabels = useMemo(
    () => selectedFieldKeys.map((key) => displayLabelForFieldKey(workOrders, key)),
    [workOrders, selectedFieldKeys]
  );

  const fieldType = useMemo(
    () =>
      selectedFieldKeys.length > 0 ? commonFieldType(workOrders, selectedFieldKeys) : null,
    [workOrders, selectedFieldKeys]
  );

  const chartTitleStorageKey = useMemo(
    () =>
      templateId && selectedFieldKeys.length > 0
        ? analyticsChartTitleStorageKey(templateId, selectedFieldKeys)
        : null,
    [templateId, selectedFieldKeys.join("|")]
  );

  const defaultChartTitle = useMemo(() => {
    const preset = inferAnalyticsChartTitlePreset(
      fieldType,
      selectedFieldKeys.length,
      chartType
    );
    if (!preset) return "";
    return buildDefaultAnalyticsChartTitle(selectedDisplayLabels, preset);
  }, [fieldType, selectedFieldKeys.length, selectedDisplayLabels, chartType]);

  useEffect(() => {
    if (!chartTitleStorageKey || !defaultChartTitle) {
      setChartTitle("");
      return;
    }
    setChartTitle(loadChartTitleFromStorage(chartTitleStorageKey) ?? defaultChartTitle);
  }, [chartTitleStorageKey, defaultChartTitle]);

  const selectedFieldItems = useMemo(
    () =>
      workOrders.flatMap((wo) =>
        selectedFieldKeys
          .map((key) => findChecklistItemByFieldKey(wo.checklistItems ?? [], key))
          .filter((item): item is ChecklistItem => item != null)
      ),
    [workOrders, selectedFieldKeys]
  );

  const multiNumber = useMemo(() => {
    if (fieldType !== "number" || selectedFieldKeys.length === 0) return null;
    return buildMultiNumberTimeData(workOrders, selectedFieldKeys, APP_TIME_ZONE);
  }, [fieldType, workOrders, selectedFieldKeys]);

  const categoricalDaily = useMemo(() => {
    if (
      (fieldType !== "dropdown" && fieldType !== "text") ||
      selectedFieldKeys.length !== 1
    ) {
      return null;
    }
    return buildCategoricalDailyTimeData(
      workOrders,
      selectedFieldKeys[0]!,
      APP_TIME_ZONE
    );
  }, [fieldType, workOrders, selectedFieldKeys]);

  const singleCategoricalChartData = useMemo(() => {
    if (
      (fieldType !== "dropdown" && fieldType !== "text") ||
      selectedFieldKeys.length !== 1
    ) {
      return [];
    }
    const fieldKey = selectedFieldKeys[0]!;
    const counts = new Map<string, number>();
    for (const wo of workOrders) {
      const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
      if (!item) continue;
      const v = item.value != null ? String(item.value) : "(empty)";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({
      name: name === "(empty)" ? "(vacío)" : name,
      value,
    }));
  }, [fieldType, workOrders, selectedFieldKeys]);

  const multiCategorical = useMemo(() => {
    if (
      (fieldType !== "dropdown" && fieldType !== "text") ||
      selectedFieldKeys.length <= 1
    ) {
      return null;
    }
    return buildMultiCategoricalUnion(workOrders, selectedFieldKeys);
  }, [fieldType, workOrders, selectedFieldKeys]);

  const singleCheckboxChartData = useMemo(() => {
    if (fieldType !== "checkbox" || selectedFieldKeys.length !== 1) return [];
    const fieldKey = selectedFieldKeys[0]!;
    let yes = 0;
    let no = 0;
    for (const wo of workOrders) {
      const item = findChecklistItemByFieldKey(wo.checklistItems, fieldKey);
      if (!item) continue;
      if (item.value === true) yes++;
      else no++;
    }
    return [
      { name: "Sí", value: yes },
      { name: "No", value: no },
    ];
  }, [fieldType, workOrders, selectedFieldKeys]);

  const multiCheckboxBars = useMemo(() => {
    if (fieldType !== "checkbox" || selectedFieldKeys.length <= 1) return [];
    return buildMultiCheckboxBars(workOrders, selectedFieldKeys);
  }, [fieldType, workOrders, selectedFieldKeys]);

  function toggleFieldKey(fieldKey: string) {
    if (selectedFieldKeys.includes(fieldKey)) {
      setFieldTypeHint(null);
      setSelectedFieldKeys((p) => p.filter((x) => x !== fieldKey));
      return;
    }
    const next = [...selectedFieldKeys, fieldKey];
    if (selectedFieldKeys.length > 0 && commonFieldType(workOrders, next) === null) {
      setFieldTypeHint("Solo puedes combinar campos del mismo tipo.");
      return;
    }
    setFieldTypeHint(null);
    setSelectedFieldKeys(next);
  }

  useEffect(() => {
    if (!fieldType) return;
    if (fieldType === "number") {
      setChartType("line");
      return;
    }
    if (fieldType === "checkbox") {
      setChartType(selectedFieldKeys.length > 1 ? "bar" : "pie");
      return;
    }
    if (fieldType === "dropdown" || fieldType === "text") {
      setChartType(selectedFieldKeys.length > 1 ? "bar" : "stacked");
    }
  }, [fieldType, selectedFieldKeys.join("|")]);

  const fieldsSelectionSummary = useMemo(() => {
    if (selectedDisplayLabels.length === 0) return "Sin campos";
    if (selectedDisplayLabels.length === 1) return selectedDisplayLabels[0]!;
    if (selectedDisplayLabels.length === 2) {
      return `${selectedDisplayLabels[0]!} · ${selectedDisplayLabels[1]!}`;
    }
    return `${selectedDisplayLabels.length} campos seleccionados`;
  }, [selectedDisplayLabels]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Plantilla de checklist
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 sm:min-w-[200px]"
          >
            <option value="">Seleccionar…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {data && data.fields.length > 0 && (
          <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:max-w-sm">
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="analytics-fields-trigger">
              Campos (mismo tipo)
            </label>
            <button
              id="analytics-fields-trigger"
              type="button"
              onClick={() => setFieldsModalOpen(true)}
              className="flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              <span className="font-medium text-primary-700">Elegir campos…</span>
              <span className="truncate text-xs text-zinc-500" title={selectedDisplayLabels.join(", ")}>
                {fieldsSelectionSummary}
              </span>
            </button>
            {fieldTypeHint && (
              <p className="mt-1 text-xs text-amber-700">{fieldTypeHint}</p>
            )}
          </div>
        )}
        <div className="flex w-full gap-4 sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 sm:w-auto"
            />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 sm:w-auto"
            />
          </div>
        </div>
      </div>

      {loading && <p className="text-zinc-500">Loading…</p>}
      {!templateId && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          Selecciona una plantilla de checklist para ver las analíticas.
        </div>
      )}
      {templateId && data?.workOrders?.length === 0 && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          No completed work orders with this checklist in the selected range.
        </div>
      )}
      {templateId && (data?.workOrders?.length ?? 0) > 0 && (data?.fields?.length ?? 0) === 0 && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          This checklist has no custom fields; add text, number, date, dropdown, or checkbox fields to see graphs.
        </div>
      )}
      {templateId && (data?.workOrders?.length ?? 0) > 0 && (data?.fields?.length ?? 0) > 0 && selectedFieldKeys.length === 0 && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          Selecciona al menos un campo para ver el gráfico.
        </div>
      )}

      {templateId && selectedFieldKeys.length > 0 && data && (
        <div className="flex flex-wrap items-center gap-2">
          {(fieldType === "number" || fieldType === "checkbox" || fieldType === "dropdown" || fieldType === "text") && (
            <select
              value={chartType}
              onChange={(e) =>
                setChartType(e.target.value as DashboardWidgetChartType)
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {fieldType === "number" ? (
                <>
                  <option value="line">Línea</option>
                  <option value="bar">Barras</option>
                </>
              ) : selectedFieldKeys.length > 1 ? (
                <option value="bar">Barras</option>
              ) : (
                <>
                  <option value="stacked">Por día</option>
                  <option value="bar">Distribución (barras)</option>
                  <option value="pie">Distribución (pastel)</option>
                </>
              )}
            </select>
          )}
          <button
            type="button"
            disabled={addToDashboardStatus === "saving" || !fieldType}
            onClick={async () => {
              setAddToDashboardStatus("saving");
              try {
                const res = await fetch("/api/dashboard/widgets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    templateId,
                    templateName: data.templateName ?? "",
                    fieldLabel: selectedFieldKeys[0],
                    fieldLabels: selectedFieldKeys,
                    dateFrom: from || null,
                    dateTo: to || null,
                    chartType: fieldType === "number" ? (chartType === "pie" ? "line" : chartType) : chartType,
                    thresholds: fieldType === "number" ? thresholds : [],
                    axisLimits,
                    chartTitle: chartTitle.trim() || null,
                  }),
                });
                if (res.ok) {
                  setAddToDashboardStatus("saved");
                } else {
                  setAddToDashboardStatus("error");
                }
              } catch {
                setAddToDashboardStatus("error");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 py-2 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <LayoutDashboard className="h-4 w-4" />
            {addToDashboardStatus === "saving"
              ? "Guardando…"
              : addToDashboardStatus === "saved"
                ? "Añadido al dashboard"
                : "Añadir al dashboard"}
          </button>
          {addToDashboardStatus === "saved" && (
            <Link href="/dashboard" className="text-sm text-primary-600 font-medium hover:underline">
              Ver dashboard
            </Link>
          )}
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        fieldType === "number" &&
        multiNumber &&
        multiNumber.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          <ChartThresholdEditor
            thresholds={thresholds}
            onChange={(next) => {
              setThresholds(next);
              if (thresholdsStorageKey) saveThresholdsToStorage(thresholdsStorageKey, next);
            }}
          />
          <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis />
          <div className="h-64 md:h-80 mt-3">
            <NumberTimeSeriesChart
              data={multiNumber.data}
              series={multiNumber.series}
              chartType={chartType === "bar" ? "bar" : "line"}
              thresholds={thresholds}
              axisLimits={axisLimits}
              colors={COLORS}
              tickFontSize={12}
            />
          </div>
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        (fieldType === "dropdown" || fieldType === "text") &&
        multiCategorical &&
        multiCategorical.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis={false} />
          <div className="h-64 md:h-80">
            <AnalyticsCountBarChart
              data={multiCategorical.data}
              xDataKey="name"
              axisLimits={axisLimits}
              bars={multiCategorical.series.map((s, i) => ({
                dataKey: s.key,
                fill: COLORS[i % COLORS.length]!,
                name: s.name,
              }))}
            />
          </div>
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        (fieldType === "dropdown" || fieldType === "text") &&
        selectedFieldKeys.length === 1 &&
        chartType === "stacked" &&
        categoricalDaily &&
        categoricalDaily.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis={false} />
          <div className="h-64 md:h-80 mt-3">
            <CategoricalDailyStackedChart
              data={categoricalDaily.data}
              series={categoricalDaily.series}
              axisLimits={axisLimits}
              colors={COLORS}
            />
          </div>
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        (fieldType === "dropdown" || fieldType === "text") &&
        selectedFieldKeys.length === 1 &&
        chartType !== "stacked" &&
        singleCategoricalChartData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          {chartType !== "pie" ? (
            <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis={false} />
          ) : null}
          <div className="h-64 md:h-80">
            {chartType === "pie" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={singleCategoricalChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
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
              <AnalyticsCountBarChart
                data={singleCategoricalChartData}
                xDataKey="name"
                axisLimits={axisLimits}
                showLegend={false}
                bars={[{ dataKey: "value", fill: "#F14C03", name: "Cantidad", radius: [4, 4, 0, 0] }]}
                tickFontSize={12}
              />
            )}
          </div>
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        fieldType === "checkbox" &&
        selectedFieldKeys.length > 1 &&
        multiCheckboxBars.some((r) => r.sí + r.no > 0) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis={false} />
          <div className="h-64 md:h-80">
            <AnalyticsCountBarChart
              data={multiCheckboxBars}
              xDataKey="name"
              axisLimits={axisLimits}
              tickFontSize={12}
              bars={[
                { dataKey: "sí", fill: "#02257D", name: "Sí", radius: [4, 4, 0, 0] },
                { dataKey: "no", fill: "#9E9F9F", name: "No", radius: [4, 4, 0, 0] },
              ]}
            />
          </div>
        </div>
      )}

      {selectedFieldKeys.length > 0 &&
        fieldType === "checkbox" &&
        selectedFieldKeys.length === 1 &&
        (singleCheckboxChartData[0]?.value > 0 || singleCheckboxChartData[1]?.value > 0) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          {chartType === "bar" ? (
            <ChartAxisLimitsEditor limits={axisLimits} onChange={updateAxisLimits} showXAxis={false} />
          ) : null}
          <div className="h-64 md:h-80">
            {chartType === "bar" ? (
              <AnalyticsCountBarChart
                data={singleCheckboxChartData}
                xDataKey="name"
                axisLimits={axisLimits}
                showLegend={false}
                tickFontSize={12}
                bars={[{ dataKey: "value", fill: "#F14C03", name: "Cantidad", radius: [4, 4, 0, 0] }]}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={singleCheckboxChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
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
      )}

      {selectedFieldKeys.length > 0 && fieldType === "date" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <EditableChartTitle
            value={chartTitle}
            onChange={setChartTitle}
            onCommit={(next) => {
              if (chartTitleStorageKey) saveChartTitleToStorage(chartTitleStorageKey, next);
            }}
          />
          <p className="text-zinc-500 text-sm">
            Campos de fecha: vista de lista. Gráfico agregado próximamente.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {selectedFieldItems.slice(0, 10).map((item, i) => (
              <li key={i}>
                <span className="text-zinc-500">{item.label}: </span>
                {item.value != null ? String(item.value).slice(0, 10) : "—"}
              </li>
            ))}
            {selectedFieldItems.length > 10 && (
              <li className="text-zinc-400">… y {selectedFieldItems.length - 10} más</li>
            )}
          </ul>
        </div>
      )}

      <AnalyticsFieldsPicker
        open={fieldsModalOpen && Boolean(data && data.fields.length > 0)}
        fields={data?.fields ?? []}
        selectedFieldKeys={selectedFieldKeys}
        fieldTypeHint={fieldTypeHint}
        onToggleField={toggleFieldKey}
        onClose={() => setFieldsModalOpen(false)}
      />
    </div>
  );
}
