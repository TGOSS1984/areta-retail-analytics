"use client";

import { EChart } from "@/components/charts/base/EChart";
import { useSalesMarginByPeriod } from "@/lib/hooks/useSalesMarginByMonth";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpMillions, formatPct } from "@/lib/format";

/** Sales and margin by business period, following the global filters.
 * No year picker of its own any more: the filter bar at the top is the
 * one place a year gets chosen. */
export function SalesMarginByMonthChart() {
  const state = useSalesMarginByPeriod();

  if (state.status === "loading") {
    return <div className="h-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }
  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
        Couldn&apos;t load sales &amp; margin: {state.message}
      </div>
    );
  }

  const points = state.data;
  const hasPartial = points.some((p) => p.isPartial);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-deep-terrain p-4 md:p-5">
      <h2 className="flex-shrink-0 text-sm font-medium text-cloud">Sales &amp; margin by period</h2>
      <p className="mb-2 mt-0.5 flex-shrink-0 text-xs text-mist">
        {hasPartial ? "* still trading, so its bar is to date" : "Business periods in the selection"}
      </p>
      <div className="min-h-0 flex-1">
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            return {
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params: Array<{ dataIndex: number }>) => {
                  const p = points[params[0]?.dataIndex ?? 0];
                  return `${p.label}${p.isPartial ? " (to date)" : ""}<br/>Sales: ${formatGbpMillions(p.salesGbp)}<br/>Margin: ${formatPct(p.marginPct)}`;
                },
              },
              legend: {
                data: ["Sales", "Margin %"],
                top: 0,
                right: 0,
                textStyle: { color: COLORS.mist, fontSize: 11 },
                itemWidth: 10,
                itemHeight: 10,
              },
              grid: { left: compact ? 48 : 56, right: compact ? 40 : 48, top: 32, bottom: 28 },
              xAxis: {
                type: "category",
                data: points.map((p) => `P${String(p.period).padStart(2, "0")}${p.isPartial ? "*" : ""}`),
                axisLine,
                axisLabel,
              },
              yAxis: [
                { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpMillions(v) }, splitLine },
                { type: "value", axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine: { show: false } },
              ],
              series: [
                {
                  name: "Sales",
                  type: "bar",
                  data: points.map((p) => ({
                    value: p.salesGbp,
                    // The part-traded period is paler, so its short bar
                    // reads as "so far" rather than "a bad period".
                    itemStyle: { color: p.isPartial ? "rgba(208,170,98,0.45)" : COLORS.gold, borderRadius: [3, 3, 0, 0] },
                  })),
                  barMaxWidth: 28,
                },
                {
                  name: "Margin %",
                  type: "line",
                  yAxisIndex: 1,
                  data: points.map((p) => p.marginPct),
                  smooth: true,
                  symbolSize: 6,
                  lineStyle: { color: COLORS.teal, width: 2 },
                  itemStyle: { color: COLORS.teal },
                },
              ],
            };
          }}
        />
      </div>
    </div>
  );
}