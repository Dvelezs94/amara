import { AnalyticsCharts } from "./AnalyticsCharts";

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Analíticas de checklist</h1>
      <p className="text-sm text-zinc-500">
        Gráficos a partir de los datos del checklist. Elige una plantilla y un campo; los datos provienen de órdenes de trabajo completadas.
      </p>
      <AnalyticsCharts />
    </div>
  );
}
