"use client";

import {
  computeAutoYDomain,
  resolveYAxisDomain,
  type ChartAxisLimits,
} from "@/lib/chart-axis-limits";
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

const DEFAULT_COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

type SeriesDef = { key: string; name: string };

export function CategoricalDailyStackedChart({
  data,
  series,
  axisLimits,
  colors = DEFAULT_COLORS,
  tickFontSize = 11,
}: {
  data: Record<string, string | number>[];
  series: SeriesDef[];
  axisLimits?: ChartAxisLimits;
  colors?: string[];
  tickFontSize?: number;
}) {
  const valueKeys = series.map((s) => s.key);
  const autoY = computeAutoYDomain(data, valueKeys);
  const yDomain = resolveYAxisDomain(
    axisLimits ?? { yAuto: true, yMin: null, yMax: null, xAuto: true, xMin: null, xMax: null },
    autoY
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: tickFontSize }}
          minTickGap={12}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} tick={{ fontSize: tickFontSize }} domain={yDomain} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: tickFontSize }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="day"
            fill={colors[i % colors.length]}
            name={s.name}
            radius={i === series.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
