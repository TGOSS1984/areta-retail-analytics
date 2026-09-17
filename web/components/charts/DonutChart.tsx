"use client";

import ReactECharts from "echarts-for-react";
import type { MixSlice } from "@/lib/queries/salesMix";

const PALETTE = ["#1F7486", "#D0AA62", "#4A5B63", "#8D9AA1", "#2E7D32"];

type TooltipParams = { name: string; value: number; percent: number };

type DonutChartProps = {
  title: string;
  slices: MixSlice[];
};

/** Shared by category mix and channel mix — same visual, different data.
 * Takes pre-fetched slices rather than owning its own query, so it stays
 * reusable for whatever the next mix-style breakdown turns out to be. */
export function DonutChart({ title, slices }: DonutChartProps) {
  const option = {
    textStyle: { fontFamily: "Montserrat, sans-serif" },
    tooltip: {
      trigger: "item",
      formatter: (params: TooltipParams) =>
        `${params.name}: £${(params.value / 1_000_000).toFixed(2)}M (${params.percent}%)`,
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: { color: "#5B6A72", fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: "pie",
        radius: ["55%", "80%"],
        center: ["36%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        data: slices.map((s, i) => ({
          name: s.label,
          value: s.salesGbp,
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5">
      <h2 className="mb-2 text-sm font-medium text-charcoal">{title}</h2>
      <ReactECharts option={option} style={{ height: 220 }} notMerge />
    </div>
  );
}