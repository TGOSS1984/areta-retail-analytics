"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { Forecast } from "@/lib/queries/forecastPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Cumulative sales across the business year: actuals as a solid gold
 * line, the projection carrying on dashed from where they stop, the range
 * as a shaded band round it, and the cumulative target in teal. Where the
 * dashed line ends against the teal one is the answer to "will we hit
 * target". The band is the usual stacked-area trick: an invisible series
 * at the low edge with the band's height stacked on top. */
export function ForecastChart({ state }: { state: AsyncState<Forecast> }) {
  return (
    <AsyncView state={state}>
      {(fc) => {
        if (!fc.available) return <EmptyState message={fc.reason} />;
        const labels = fc.weeks.map((w) => `Wk ${w.week}`);
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 44 : 56, right: 12, top: 32, bottom: 28 },
                legend: {
                  top: 0,
                  right: 0,
                  data: ["Actual", "Projection", "Target"],
                  textStyle: { color: COLORS.mist, fontSize: 11 },
                  itemWidth: 14,
                  itemHeight: 8,
                },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const w = fc.weeks[params[0]?.dataIndex ?? 0];
                    const lines = [`Week ${w.week}, cumulative`];
                    if (w.cumActual !== null) lines.push(`Actual: ${formatGbpShort(w.cumActual, 2)}`);
                    if (w.cumForecast !== null && w.cumActual === null) {
                      lines.push(`Projection: ${formatGbpShort(w.cumForecast, 2)}`);
                      lines.push(`Range: ${formatGbpShort(w.cumLow ?? 0, 1)} to ${formatGbpShort(w.cumHigh ?? 0, 1)}`);
                    }
                    lines.push(`Target: ${formatGbpShort(w.cumTarget, 2)}`);
                    return lines.join("<br/>");
                  },
                },
                xAxis: { type: "category", boundaryGap: false, data: labels, axisLine, axisLabel },
                yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 0) }, splitLine },
                series: [
                  {
                    name: "Band base",
                    type: "line",
                    stack: "band",
                    data: fc.weeks.map((w) => w.cumLow),
                    lineStyle: { opacity: 0 },
                    showSymbol: false,
                    silent: true,
                    tooltip: { show: false },
                  },
                  {
                    name: "Range",
                    type: "line",
                    stack: "band",
                    data: fc.weeks.map((w) => (w.cumHigh === null || w.cumLow === null ? null : w.cumHigh - w.cumLow)),
                    lineStyle: { opacity: 0 },
                    showSymbol: false,
                    areaStyle: { color: "rgba(208,170,98,0.18)" },
                    silent: true,
                  },
                  {
                    name: "Target",
                    type: "line",
                    data: fc.weeks.map((w) => w.cumTarget),
                    showSymbol: false,
                    lineStyle: { color: COLORS.teal, width: 2 },
                    itemStyle: { color: COLORS.teal },
                  },
                  {
                    name: "Actual",
                    type: "line",
                    data: fc.weeks.map((w) => w.cumActual),
                    showSymbol: false,
                    lineStyle: { color: COLORS.gold, width: 2.5 },
                    itemStyle: { color: COLORS.gold },
                  },
                  {
                    name: "Projection",
                    type: "line",
                    data: fc.weeks.map((w) => w.cumForecast),
                    showSymbol: false,
                    lineStyle: { color: COLORS.gold, width: 2, type: "dashed" },
                    itemStyle: { color: COLORS.gold },
                  },
                ],
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}