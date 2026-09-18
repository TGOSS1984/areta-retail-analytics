"use client";

import ReactECharts from "echarts-for-react";
import { useMonthlyTrend } from "@/lib/hooks/useMonthlyTrend";

const CURRENT_YEAR_COLOR = "#D0AA62"; // summit gold
const PRIOR_YEAR_COLOR = "#8D9AA1"; // mist

function formatGbpAxis(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}K`;
  return `£${value}`;
}

export function SalesTrendChart() {
  const trend = useMonthlyTrend();

  if (trend.status === "loading") {
    return <div className="h-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (trend.status === "error") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-mist">
        Couldn&apos;t load the sales trend: {trend.message}
      </div>
    );
  }

  const { points, currentYear, priorYear, excludedPartialMonth } = trend.data;

  const option = {
    textStyle: { fontFamily: "Montserrat, sans-serif" },
    grid: { left: 56, right: 16, top: 36, bottom: 28 },
    legend: {
      data: [`${currentYear}`, `${priorYear}`],
      top: 0,
      right: 0,
      textStyle: { color: "#8D9AA1", fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number | string) =>
        typeof value === "number" ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : String(value),
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.monthName.slice(0, 3)),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      axisLabel: { color: "#8D9AA1", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#8D9AA1", fontSize: 11, formatter: formatGbpAxis },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: [
      {
        name: `${currentYear}`,
        type: "line",
        data: points.map((p) => p.currentYearSales),
        connectNulls: false,
        smooth: 0.2,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: CURRENT_YEAR_COLOR, width: 2.5 },
        itemStyle: { color: CURRENT_YEAR_COLOR },
        areaStyle: { color: CURRENT_YEAR_COLOR, opacity: 0.12 },
      },
      {
        name: `${priorYear}`,
        type: "line",
        data: points.map((p) => p.priorYearSales),
        smooth: 0.2,
        symbol: "none",
        lineStyle: { color: PRIOR_YEAR_COLOR, width: 2, type: "dashed" },
      },
    ],
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-deep-terrain p-5">
      <div className="mb-1 flex flex-shrink-0 items-center justify-between">
        <h2 className="text-sm font-medium text-cloud">Sales trend</h2>
      </div>
      <div className="min-h-0 flex-1">
        <ReactECharts option={option} style={{ height: "100%" }} notMerge />
      </div>
      {excludedPartialMonth && (
        <p className="mt-2 flex-shrink-0 text-[11px] text-mist">
          {excludedPartialMonth} {currentYear} isn&apos;t shown yet — the month&apos;s still in progress.
        </p>
      )}
    </div>
  );
}