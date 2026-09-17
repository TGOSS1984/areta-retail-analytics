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
    return <div className="h-80 animate-pulse rounded-xl bg-alpine-stone/40" />;
  }

  if (trend.status === "error") {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl bg-alpine-stone/20 text-sm text-stone">
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
      textStyle: { color: "#5B6A72", fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number | string) =>
        typeof value === "number" ? `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : String(value),
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.monthName.slice(0, 3)),
      axisLine: { lineStyle: { color: "#E8E1D6" } },
      axisLabel: { color: "#5B6A72", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#5B6A72", fontSize: 11, formatter: formatGbpAxis },
      splitLine: { lineStyle: { color: "#E8E1D6" } },
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
    <div className="rounded-xl bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-medium text-charcoal">Sales trend</h2>
      </div>
      <ReactECharts option={option} style={{ height: 300 }} notMerge />
      {excludedPartialMonth && (
        <p className="mt-2 text-[11px] text-stone">
          {excludedPartialMonth} {currentYear} isn&apos;t shown yet — the month&apos;s still in progress.
        </p>
      )}
    </div>
  );
}