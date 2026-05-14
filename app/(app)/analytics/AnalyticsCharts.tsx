"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { LayoutDashboard, X } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  buildMultiCategoricalUnion,
  buildMultiCheckboxBars,
  buildMultiNumberTimeData,
  commonFieldType,
} from "@/lib/analytics-checklist-multi-chart";

type Template = { id: string; name: string };
type ChecklistItem = {
  label: string;
  type: string;
  fieldType: string | null;
  value: unknown;
};
type WorkOrderData = {
  id: string;
  title: string | null;
  completedAt: string | null;
  checklistItems: ChecklistItem[];
};
type ApiResponse = {
  templateId: string;
  templateName: string;
  workOrders: WorkOrderData[];
  fields: string[];
};

const COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

export function AnalyticsCharts() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [selectedFieldLabels, setSelectedFieldLabels] = useState<string[]>([]);
  const [fieldTypeHint, setFieldTypeHint] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<"line" | "bar" | "pie">("line");
  const [addToDashboardStatus, setAddToDashboardStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);

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
      setSelectedFieldLabels([]);
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
        setSelectedFieldLabels((prev) => {
          const fields: string[] = Array.isArray(d.fields) ? d.fields : [];
          const kept = prev.filter((x) => fields.includes(x));
          if (kept.length > 0) return kept;
          return fields[0] ? [fields[0]] : [];
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [templateId, from, to]);

  const workOrders = data?.workOrders ?? [];

  const fieldType = useMemo(
    () =>
      selectedFieldLabels.length > 0
        ? commonFieldType(workOrders, selectedFieldLabels)
        : null,
    [workOrders, selectedFieldLabels]
  );

  const selectedFieldItems = useMemo(
    () =>
      workOrders.flatMap((wo) =>
        (wo.checklistItems ?? []).filter((i) => selectedFieldLabels.includes(i.label))
      ),
    [workOrders, selectedFieldLabels]
  );

  const multiNumber = useMemo(() => {
    if (fieldType !== "number" || selectedFieldLabels.length === 0) return null;
    return buildMultiNumberTimeData(workOrders, selectedFieldLabels, APP_TIME_ZONE);
  }, [fieldType, workOrders, selectedFieldLabels]);

  const singleCategoricalChartData = useMemo(() => {
    if (
      (fieldType !== "dropdown" && fieldType !== "text") ||
      selectedFieldLabels.length !== 1
    ) {
      return [];
    }
    const label = selectedFieldLabels[0]!;
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
  }, [fieldType, workOrders, selectedFieldLabels]);

  const multiCategorical = useMemo(() => {
    if (
      (fieldType !== "dropdown" && fieldType !== "text") ||
      selectedFieldLabels.length <= 1
    ) {
      return null;
    }
    return buildMultiCategoricalUnion(workOrders, selectedFieldLabels);
  }, [fieldType, workOrders, selectedFieldLabels]);

  const singleCheckboxChartData = useMemo(() => {
    if (fieldType !== "checkbox" || selectedFieldLabels.length !== 1) return [];
    const label = selectedFieldLabels[0]!;
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
  }, [fieldType, workOrders, selectedFieldLabels]);

  const multiCheckboxBars = useMemo(() => {
    if (fieldType !== "checkbox" || selectedFieldLabels.length <= 1) return [];
    return buildMultiCheckboxBars(workOrders, selectedFieldLabels);
  }, [fieldType, workOrders, selectedFieldLabels]);

  function toggleFieldLabel(f: string) {
    if (selectedFieldLabels.includes(f)) {
      if (selectedFieldLabels.length <= 1) return;
      setFieldTypeHint(null);
      setSelectedFieldLabels((p) => p.filter((x) => x !== f));
      return;
    }
    const next = [...selectedFieldLabels, f];
    if (selectedFieldLabels.length > 0 && commonFieldType(workOrders, next) === null) {
      setFieldTypeHint("Solo puedes combinar campos del mismo tipo.");
      return;
    }
    setFieldTypeHint(null);
    setSelectedFieldLabels(next);
  }

  useEffect(() => {
    if (!fieldType) return;
    if (fieldType === "number") {
      setChartType("line");
      return;
    }
    if (fieldType === "checkbox") {
      setChartType(selectedFieldLabels.length > 1 ? "bar" : "pie");
      return;
    }
    if (fieldType === "dropdown" || fieldType === "text") {
      setChartType(selectedFieldLabels.length > 1 ? "bar" : "bar");
    }
  }, [fieldType, selectedFieldLabels.join("|")]);

  const fieldsSelectionSummary = useMemo(() => {
    if (selectedFieldLabels.length === 0) return "Sin campos";
    if (selectedFieldLabels.length === 1) return selectedFieldLabels[0]!;
    if (selectedFieldLabels.length === 2) return `${selectedFieldLabels[0]!} · ${selectedFieldLabels[1]!}`;
    return `${selectedFieldLabels.length} campos seleccionados`;
  }, [selectedFieldLabels]);

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
              <span className="truncate text-xs text-zinc-500" title={selectedFieldLabels.join(", ")}>
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
      {templateId && (data?.workOrders?.length ?? 0) > 0 && (data?.fields?.length ?? 0) > 0 && selectedFieldLabels.length === 0 && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          Selecciona al menos un campo para ver el gráfico.
        </div>
      )}

      {templateId && selectedFieldLabels.length > 0 && data && (
        <div className="flex flex-wrap items-center gap-2">
          {(fieldType === "number" || fieldType === "checkbox" || fieldType === "dropdown" || fieldType === "text") && (
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as "line" | "bar" | "pie")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {fieldType === "number" ? (
                <>
                  <option value="line">Línea</option>
                  <option value="bar">Barras</option>
                </>
              ) : selectedFieldLabels.length > 1 ? (
                <option value="bar">Barras</option>
              ) : (
                <>
                  <option value="bar">Barras</option>
                  <option value="pie">Pastel</option>
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
                    fieldLabel: selectedFieldLabels[0],
                    fieldLabels: selectedFieldLabels,
                    dateFrom: from || null,
                    dateTo: to || null,
                    chartType: fieldType === "number" ? (chartType === "pie" ? "line" : chartType) : chartType,
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

      {selectedFieldLabels.length > 0 &&
        fieldType === "number" &&
        multiNumber &&
        multiNumber.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels.join(", ")} en el tiempo (punto por orden)
          </h2>
          <div className="h-64 md:h-80">
            {chartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={multiNumber.data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 12 }} />
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
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 12 }} />
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
      )}

      {selectedFieldLabels.length > 0 &&
        (fieldType === "dropdown" || fieldType === "text") &&
        multiCategorical &&
        multiCategorical.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels.join(", ")} — comparación por categoría
          </h2>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={multiCategorical.data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
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
      )}

      {selectedFieldLabels.length > 0 &&
        (fieldType === "dropdown" || fieldType === "text") &&
        selectedFieldLabels.length === 1 &&
        singleCategoricalChartData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels[0]} — distribución
          </h2>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={singleCategoricalChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F14C03" name="Cantidad" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {selectedFieldLabels.length > 0 &&
        fieldType === "checkbox" &&
        selectedFieldLabels.length > 1 &&
        multiCheckboxBars.some((r) => r.sí + r.no > 0) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels.join(", ")} — sí / no por campo
          </h2>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={multiCheckboxBars} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sí" fill="#02257D" name="Sí" radius={[4, 4, 0, 0]} />
                <Bar dataKey="no" fill="#9E9F9F" name="No" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedFieldLabels.length > 0 &&
        fieldType === "checkbox" &&
        selectedFieldLabels.length === 1 &&
        (singleCheckboxChartData[0]?.value > 0 || singleCheckboxChartData[1]?.value > 0) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels[0]} — sí / no
          </h2>
          <div className="h-64 md:h-80">
            {chartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={singleCheckboxChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
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

      {selectedFieldLabels.length > 0 && fieldType === "date" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {selectedFieldLabels.join(", ")}
          </h2>
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

      {fieldsModalOpen && data && data.fields.length > 0 ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
          role="presentation"
          onClick={() => setFieldsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="analytics-fields-modal-title"
            className="flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:max-h-[min(85vh,640px)] md:rounded-xl md:border-b md:shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <h2 id="analytics-fields-modal-title" className="text-sm font-semibold text-zinc-900">
                Campos del checklist
              </h2>
              <button
                type="button"
                onClick={() => setFieldsModalOpen(false)}
                aria-label="Cerrar"
                className="rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
              Marca uno o más campos del mismo tipo para graficarlos juntos. Hay {data.fields.length}{" "}
              campos en esta plantilla.
            </p>
            {fieldTypeHint ? (
              <p className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                {fieldTypeHint}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <ul className="space-y-0.5">
                {data.fields.map((f) => (
                  <li key={f}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={selectedFieldLabels.includes(f)}
                        onChange={() => toggleFieldLabel(f)}
                        className="mt-0.5 shrink-0 rounded border-zinc-400"
                      />
                      <span className="min-w-0 break-words">{f}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 justify-end border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
              <button
                type="button"
                onClick={() => setFieldsModalOpen(false)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
