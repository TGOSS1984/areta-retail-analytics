"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { useAvailableYears, useSalesMarginByMonth } from "@/lib/hooks/useSalesMarginByMonth";
import { formatGbpMillions, formatPct } from "@/lib/format";

export function SalesMarginByMonthChart() {
  const years = useAvailableYears();
  const [yearOverride, setYearOverride] = useState<number | null>(null);
  // Defaults to the most recent year with data once the years list
  // resolves (fetchAvailableYears returns them DESC) — no separate
  // effect needed, this is just derived on every render until the user
  // picks something else.
  const effectiveYear = yearOverride ?? (years.status === "ready" ? years.data[0] : null);

  const trend = useSalesMarginByMonth(effectiveYear);

  if (years.status === "loading" || trend.status === "loading") {
    return <div className="h-96 animate-pulse rounded-xl bg-alpine-stone/40" />;
  }

  if (years.status === "error" || trend.status === "error") {
    const message = years.status === "error" ? years.message : trend.status === "error" ? trend.message : "";
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-alpine-stone/20 p-4 text-center text-sm text-stone">
        Couldn&apos;t load sales &amp; margin by month: {message}
      </div>
    );
  }

  const points = trend.data.points;

  const option = {
    textStyle: { fontFamily: "Montserrat, sans-serif" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ axisValue: string; seriesName: string; value: number }>) => {
        const lines = params.map((p) =>
          p.seriesName === "Margin %" ? `${p.seriesName}: ${formatPct(p.value)}` : `${p.seriesName}: ${formatGbpMillions(p.value)}`,
        );
        return `${params[0]?.axisValue}<br/>${lines.join("<br/>")}`;
      },
    },
    legend: {
      data: ["Sales", "Margin %"],
      top: 0,
      right: 0,
      textStyle: { color: "#5B6A72", fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { left: 56, right: 48, top: 40, bottom: 28 },
    xAxis: {
      type: "category",
      data: points.map((p) => p.monthName.slice(0, 3)),
      axisLine: { lineStyle: { color: "#D8D2C4" } },
      axisLabel: { color: "#5B6A72", fontSize: 11 },
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { color: "#5B6A72", fontSize: 11, formatter: (v: number) => formatGbpMillions(v) },
        splitLine: { lineStyle: { color: "#EEE9DF" } },
      },
      {
        type: "value",
        axisLabel: { color: "#5B6A72", fontSize: 11, formatter: "{value}%" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Sales",
        type: "bar",
        data: points.map((p) => p.salesGbp),
        itemStyle: { color: "#D0AA62", borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: "Margin %",
        type: "line",
        yAxisIndex: 1,
        data: points.map((p) => p.marginPct),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: "#1F7486", width: 2 },
        itemStyle: { color: "#1F7486" },
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-charcoal">Sales &amp; margin by month</h2>
        <select
          value={effectiveYear ?? ""}
          onChange={(e) => setYearOverride(Number(e.target.value))}
          className="rounded-lg border border-alpine-stone/40 bg-white px-2 py-1 text-xs text-charcoal"
        >
          {years.data.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {trend.data.excludedPartialMonth && (
        <p className="mb-2 -mt-1 text-xs text-stone">
          {trend.data.excludedPartialMonth} isn&apos;t shown yet — the month&apos;s still in progress.
        </p>
      )}
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </div>
  );
}