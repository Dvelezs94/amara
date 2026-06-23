"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  computeAutoYDomain,
  resolveYAxisDomain,
  type ChartAxisLimits,
} from "@/lib/chart-axis-limits";

type BarDef = {
  dataKey: string;
  fill: string;
  name: string;
  radius?: [number, number, number, number];
};

export function AnalyticsCountBarChart({
  data,
  xDataKey,
  bars,
  axisLimits,
  tickFontSize = 11,
  showLegend = true,
}: {
  data: Record<string, string | number>[];
  xDataKey: string;
  bars: BarDef[];
  axisLimits?: ChartAxisLimits;
  tickFontSize?: number;
  showLegend?: boolean;
}) {
  const valueKeys = bars.map((b) => b.dataKey);
  const autoY = computeAutoYDomain(data, valueKeys);
  const yDomain = resolveYAxisDomain(
    axisLimits ?? { yAuto: true, yMin: null, yMax: null, xAuto: true, xMin: null, xMax: null },
    autoY
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey={xDataKey} tick={{ fontSize: tickFontSize }} />
        <YAxis tick={{ fontSize: tickFontSize }} domain={yDomain} allowDecimals={false} />
        <Tooltip />
        {showLegend ? <Legend /> : null}
        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.fill}
            name={bar.name}
            radius={bar.radius ?? [2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
