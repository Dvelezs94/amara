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

const DEFAULT_COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

type SeriesDef = { key: string; name: string };

export function CategoricalDailyStackedChart({
  data,
  series,
  colors = DEFAULT_COLORS,
  tickFontSize = 11,
}: {
  data: Record<string, string | number>[];
  series: SeriesDef[];
  colors?: string[];
  tickFontSize?: number;
}) {
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
        <YAxis allowDecimals={false} tick={{ fontSize: tickFontSize }} />
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
