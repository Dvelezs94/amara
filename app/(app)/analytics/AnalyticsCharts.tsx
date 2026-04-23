"use client";

import { useEffect, useState } from "react";
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
import { LayoutDashboard } from "lucide-react";

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
  const [fieldLabel, setFieldLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<"line" | "bar" | "pie">("line");
  const [addToDashboardStatus, setAddToDashboardStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/checklist-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!templateId) {
      setData(null);
      setFieldLabel("");
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
        if (d.fields?.length && !d.fields.includes(fieldLabel)) {
          setFieldLabel(d.fields[0] ?? "");
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [templateId, from, to]);

  const selectedField = data?.workOrders?.flatMap((wo) =>
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
      chartData = Array.from(counts.entries()).map(([name, value]) => ({ name: name === "(empty)" ? "(vacío)" : name, value }));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Plantilla de checklist
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 min-w-[200px]"
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
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Field
            </label>
            <select
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 min-w-[180px]"
            >
              {data.fields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
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
      {templateId && (data?.workOrders?.length ?? 0) > 0 && (data?.fields?.length ?? 0) > 0 && !fieldLabel && !loading && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-500">
          Selecciona un campo para ver el gráfico.
        </div>
      )}

      {templateId && fieldLabel && data && (
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
            disabled={addToDashboardStatus === "saving"}
            onClick={async () => {
              setAddToDashboardStatus("saving");
              try {
                const res = await fetch("/api/dashboard/widgets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    templateId,
                    templateName: data.templateName ?? "",
                    fieldLabel,
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

      {fieldLabel && fieldType === "number" && lineData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {fieldLabel} en el tiempo (punto por registro)
          </h2>
          <div className="h-64 md:h-80">
            {chartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#02257D" name={fieldLabel} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#02257D"
                    strokeWidth={2}
                    name={fieldLabel}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {fieldLabel && (fieldType === "dropdown" || fieldType === "text") && chartData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {fieldLabel} — distribución
          </h2>
          <div className="h-64 md:h-80">
            {chartType === "pie" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
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
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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

      {fieldLabel && fieldType === "checkbox" && (chartData[0]?.value > 0 || chartData[1]?.value > 0) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            {fieldLabel} — sí / no
          </h2>
          <div className="h-64 md:h-80">
            {chartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
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
      )}

      {fieldLabel && fieldType === "date" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">{fieldLabel}</h2>
          <p className="text-zinc-500 text-sm">
            Campos de fecha: vista de lista. Gráfico agregado próximamente.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {selectedField.slice(0, 10).map((item, i) => (
              <li key={i}>
                {item.value != null ? String(item.value).slice(0, 10) : "—"}
              </li>
            ))}
            {selectedField.length > 10 && (
              <li className="text-zinc-400">… and {selectedField.length - 10} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
