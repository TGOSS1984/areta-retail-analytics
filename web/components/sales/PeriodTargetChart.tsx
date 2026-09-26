"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { SalesPageData } from "@/lib/queries/salesPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Bar and line: sales and target per business period as bars, target
 * achievement as a line on its own axis with a 100% marker. A period
 * still trading is compared with its target phased to date, not the
 * whole period's, and is labelled "to date". */
export function PeriodTargetChart({ state }: { state: AsyncState<SalesPageData> }) {
  return (
    <AsyncView state={state}>
      {({ periods }) => (
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            const labels = periods.map((p) => `P${String(p.period).padStart(2, "0")}${p.isPartial ? "*" : ""}`);
            const achievement = periods.map((p) => (p.targetToDate ? (p.salesTy / p.targetToDate) * 100 : null));
            // Achievement axis sized to the data with 100% always in view,
            // rounded out to the nearest 5, so the line has room to move.
            const known = achievement.filter((a): a is number => a !== null);
            const achMin = Math.floor((Math.min(100, ...known) - 5) / 5) * 5;
            const achMax = Math.ceil((Math.max(100, ...known) + 5) / 5) * 5;
            return {
              grid: { left: compact ? 44 : 56, right: compact ? 40 : 48, top: 32, bottom: 28 },
              legend: {
                top: 0,
                right: 0,
                textStyle: { color: COLORS.mist, fontSize: 11 },
                itemWidth: 10,
                itemHeight: 10,
                data: ["Sales", "Target", "Achievement"],
              },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params: Array<{ dataIndex: number }>) => {
                  const p = periods[params[0]?.dataIndex ?? 0];
                  const a = achievement[params[0]?.dataIndex ?? 0];
                  return `${p.label}${p.isPartial ? " (to date)" : ""}<br/>Sales: ${formatGbpShort(p.salesTy, 2)}<br/>Target: ${formatGbpShort(p.targetToDate, 2)}${
                    p.isPartial ? ` of ${formatGbpShort(p.targetFull, 2)}` : ""
                  }<br/>Achievement: ${a === null ? "–" : `${a.toFixed(1)}%`}`;
                },
              },
              xAxis: { type: "category", data: labels, axisLine, axisLabel },
              yAxis: [
                { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 1) }, splitLine },
                {
                  type: "value",
                  min: achMin,
                  max: achMax,
                  axisLabel: { ...axisLabel, formatter: "{value}%" },
                  splitLine: { show: false },
                },
              ],
              series: [
                {
                  name: "Sales",
                  type: "bar",
                  data: periods.map((p) => p.salesTy),
                  barMaxWidth: 22,
                  itemStyle: { color: COLORS.gold, borderRadius: [3, 3, 0, 0] },
                },
                {
                  name: "Target",
                  type: "bar",
                  data: periods.map((p) => p.targetToDate),
                  barMaxWidth: 22,
                  itemStyle: { color: "rgba(31,116,134,0.55)", borderColor: COLORS.teal, borderRadius: [3, 3, 0, 0] },
                },
                {
                  name: "Achievement",
                  type: "line",
                  yAxisIndex: 1,
                  data: achievement,
                  smooth: true,
                  symbolSize: 6,
                  lineStyle: { color: COLORS.cloud, width: 2 },
                  itemStyle: { color: COLORS.cloud },
                  markLine: {
                    silent: true,
                    symbol: "none",
                    lineStyle: { color: COLORS.successBright, type: "dashed" },
                    label: { color: COLORS.successBright, fontSize: 10, formatter: "100%" },
                    data: [{ yAxis: 100 }],
                  },
                },
              ],
            };
          }}
        />
      )}
    </AsyncView>
  );
}