"use client";

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
  Legend,
  ReferenceLine,
} from "recharts";
import {
  computeNumericChartDomain,
  highestExceededThreshold,
  resolveThresholdColor,
  valueExceedsAnyThreshold,
  type ChartThreshold,
} from "@/lib/chart-thresholds";
import {
  computeAutoXDomainFromTimestamps,
  resolveXAxisDomain,
  resolveYAxisDomain,
  type ChartAxisLimits,
} from "@/lib/chart-axis-limits";
import { APP_TIME_ZONE } from "@/lib/timezone";

const DEFAULT_COLORS = ["#02257D", "#F14C03", "#9E9F9F", "#000000", "#3355AA", "#E85A0A"];

type SeriesDef = { key: string; name: string };

export function NumberTimeSeriesChart({
  data,
  series,
  chartType,
  thresholds,
  axisLimits,
  colors = DEFAULT_COLORS,
  tickFontSize = 11,
  margin = { top: 8, right: 12, left: 8, bottom: 8 },
  timeZone = APP_TIME_ZONE,
}: {
  data: Record<string, string | number | null>[];
  series: SeriesDef[];
  chartType: "line" | "bar";
  thresholds: ChartThreshold[];
  axisLimits?: ChartAxisLimits;
  colors?: string[];
  tickFontSize?: number;
  margin?: { top: number; right: number; left: number; bottom: number };
  timeZone?: string;
}) {
  const seriesKeys = series.map((s) => s.key);
  const autoY = computeNumericChartDomain(data, seriesKeys, thresholds);
  const yDomain = resolveYAxisDomain(axisLimits ?? { yAuto: true, yMin: null, yMax: null, xAuto: true, xMin: null, xMax: null }, autoY);
  const autoX = computeAutoXDomainFromTimestamps(data);
  const xDomain = resolveXAxisDomain(
    axisLimits ?? { yAuto: true, yMin: null, yMax: null, xAuto: true, xMin: null, xMax: null },
    autoX
  );

  const formatTs = (ts: number) =>
    new Date(ts).toLocaleString("es-MX", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });

  const thresholdLines = thresholds.map((t, i) => {
    const lineColor = resolveThresholdColor(t);
    return (
      <ReferenceLine
        key={t.id}
        y={t.value}
        stroke={lineColor}
        strokeDasharray="6 4"
        strokeWidth={2}
        ifOverflow="extendDomain"
        label={{
          value: t.label?.trim() ? t.label : String(t.value),
          position: "insideTopRight",
          fill: lineColor,
          fontSize: tickFontSize,
        }}
      />
    );
  });

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            type="number"
            dataKey="ts"
            domain={xDomain}
            tick={{ fontSize: tickFontSize }}
            tickFormatter={formatTs}
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: tickFontSize }} domain={yDomain} />
          <Tooltip />
          <Legend />
          {thresholdLines}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={colors[i % colors.length]}
              name={s.name}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis
          type="number"
          dataKey="ts"
          domain={xDomain}
          tick={{ fontSize: tickFontSize }}
          tickFormatter={formatTs}
          minTickGap={20}
        />
        <YAxis tick={{ fontSize: tickFontSize }} domain={yDomain} />
        <Tooltip />
        <Legend />
        {thresholdLines}
        {series.map((s, i) => {
          const stroke = colors[i % colors.length]!;
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={stroke}
              strokeWidth={2}
              name={s.name}
              connectNulls
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) {
                  return <circle cx={0} cy={0} r={0} fill="none" stroke="none" />;
                }
                const val = payload[s.key];
                const exceeded = highestExceededThreshold(val, thresholds);
                const over = exceeded != null;
                const alertFill = exceeded ? resolveThresholdColor(exceeded) : stroke;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={over ? 4 : 3}
                    fill={over ? alertFill : stroke}
                    stroke={over ? alertFill : stroke}
                    strokeWidth={over ? 2 : 1}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
