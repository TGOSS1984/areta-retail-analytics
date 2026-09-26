"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchDiscountBands } from "@/lib/queries/marginsPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Bar and line: sales in each discount band as bars, the band's gross
 * margin as a line on its own axis. Read left to right it's the cost of
 * discounting: how much margin each step deeper gives away, set against
 * how much of the business actually sells there. */
export function DiscountBandChart() {
  const state = useFilteredData(fetchDiscountBands);
  return (
    <AsyncView state={state}>
      {(bands) => (
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            const total = bands.reduce((a, b) => a + b.sales, 0);
            const margins = bands.map((b) => b.margin * 100);
            return {
              grid: { left: compact ? 44 : 56, right: compact ? 40 : 48, top: 32, bottom: compact ? 56 : 44 },
              legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params: Array<{ dataIndex: number }>) => {
                  const b = bands[params[0]?.dataIndex ?? 0];
                  return `${b.band}<br/>${formatGbpShort(b.sales, 2)} (${total ? ((b.sales / total) * 100).toFixed(1) : 0}% of sales)<br/>Margin ${(b.margin * 100).toFixed(1)}%`;
                },
              },
              xAxis: {
                type: "category",
                data: bands.map((b) => b.band),
                axisLine,
                axisLabel: { ...axisLabel, interval: 0, rotate: compact ? 30 : 0, fontSize: 10 },
              },
              yAxis: [
                { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 0) }, splitLine },
                {
                  type: "value",
                  min: Math.floor((Math.min(...margins) - 5) / 5) * 5,
                  max: Math.ceil((Math.max(...margins) + 5) / 5) * 5,
                  axisLabel: { ...axisLabel, formatter: "{value}%" },
                  splitLine: { show: false },
                },
              ],
              series: [
                {
                  name: "Sales",
                  type: "bar",
                  data: bands.map((b) => b.sales),
                  barMaxWidth: 36,
                  itemStyle: { color: COLORS.teal, borderRadius: [3, 3, 0, 0] },
                },
                {
                  name: "Gross margin",
                  type: "line",
                  yAxisIndex: 1,
                  data: margins,
                  symbolSize: 8,
                  lineStyle: { color: COLORS.gold, width: 2 },
                  itemStyle: { color: COLORS.gold },
                  label: { show: true, position: "top", color: COLORS.cloud, fontSize: 10, formatter: (p: { value: number }) => `${p.value.toFixed(0)}%` },
                },
              ],
            };
          }}
        />
      )}
    </AsyncView>
  );
}