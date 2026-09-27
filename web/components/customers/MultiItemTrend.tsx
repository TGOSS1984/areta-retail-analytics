"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchMultiItemTrend } from "@/lib/queries/customersPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";

/** Step line: the share of baskets with two or more items, week by week,
 * against the same weeks last year. Stepped rather than smoothed, because
 * each value is one whole week, not a point on a curve. */
export function MultiItemTrend() {
  const state = useFilteredData(fetchMultiItemTrend);
  return (
    <AsyncView state={state}>
      {(weeks) => (
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            return {
              grid: { left: compact ? 40 : 48, right: 12, top: 32, bottom: 28 },
              legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                valueFormatter: (v: number | null) => (v === null || v === undefined ? "–" : `${v.toFixed(1)}%`),
              },
              xAxis: { type: "category", data: weeks.map((w) => `Wk ${w.week}`), axisLine, axisLabel },
              yAxis: { type: "value", scale: true, axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
              series: [
                {
                  name: "This year",
                  type: "line",
                  step: "middle",
                  showSymbol: false,
                  data: weeks.map((w) => (w.ty === null ? null : w.ty * 100)),
                  lineStyle: { color: COLORS.gold, width: 2 },
                  itemStyle: { color: COLORS.gold },
                },
                {
                  name: "Last year",
                  type: "line",
                  step: "middle",
                  showSymbol: false,
                  data: weeks.map((w) => (w.ly === null ? null : w.ly * 100)),
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