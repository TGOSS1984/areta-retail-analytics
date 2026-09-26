"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchWeeklySales } from "@/lib/queries/salesPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Filled line: this year's weekly sales as a gold area, last year's as a
 * dashed line over it, so the gap between them is the story. */
export function WeeklyTrendChart() {
  const state = useFilteredData(fetchWeeklySales);
  return (
    <AsyncView state={state}>
      {(weeks) => (
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            return {
              grid: { left: compact ? 44 : 56, right: 12, top: 32, bottom: 28 },
              legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                formatter: (params: Array<{ axisValue: string; seriesName: string; value: number | null }>) => {
                  const ty = params.find((p) => p.seriesName === "This year")?.value ?? null;
                  const ly = params.find((p) => p.seriesName === "Last year")?.value ?? null;
                  const diff = ty !== null && ly ? ` (${ty >= ly ? "+" : ""}${((ty / ly - 1) * 100).toFixed(1)}%)` : "";
                  return `${params[0]?.axisValue}<br/>This year: ${ty === null ? "–" : formatGbpShort(ty, 2)}${diff}<br/>Last year: ${ly === null ? "–" : formatGbpShort(ly, 2)}`;
                },
              },
              xAxis: {
                type: "category",
                boundaryGap: false,
                data: weeks.map((w) => `Wk ${w.week}`),
                axisLine,
                axisLabel: { ...axisLabel, interval: compact ? "auto" : undefined },
              },
              yAxis: {
                type: "value",
                axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 1) },
                splitLine,
              },
              series: [
                {
                  name: "This year",
                  type: "line",
                  data: weeks.map((w) => w.ty),
                  smooth: true,
                  showSymbol: false,
                  lineStyle: { color: COLORS.gold, width: 2 },
                  itemStyle: { color: COLORS.gold },
                  areaStyle: {
                    color: {
                      type: "linear", x: 0, y: 0, x2: 0, y2: 1,
                      colorStops: [
                        { offset: 0, color: "rgba(208,170,98,0.45)" },
                        { offset: 1, color: "rgba(208,170,98,0.02)" },
                      ],
                    },
                  },
                },
                {
                  name: "Last year",
                  type: "line",
                  data: weeks.map((w) => w.ly),
                  smooth: true,
                  showSymbol: false,
                  lineStyle: { color: COLORS.mist, width: 1.5, type: "dashed" },
                  itemStyle: { color: COLORS.mist },
                },
              ],
            };
          }}
        />
      )}
    </AsyncView>
  );
}