import { AnalyticsCharts } from "./AnalyticsCharts";

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Gráficos a partir de los datos del checklist. Elige una plantilla y un campo; los datos
        provienen de órdenes de trabajo completadas.
      </p>
      <AnalyticsCharts />
    </div>
  );
}
