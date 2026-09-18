"use client";

import ReactECharts from "echarts-for-react";
import type { MixSlice } from "@/lib/queries/salesMix";
import { formatGbpMillions } from "@/lib/format";

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
  // The ring's own total — not a second query. Slices already sum to
  // the whole (channel/category sums have been checked against the
  // total elsewhere in this project), so re-deriving it here from what
  // was already fetched is simpler and can't drift out of sync with
  // what the ring itself is showing.
  const total = slices.reduce((sum, s) => sum + s.salesGbp, 0);

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
      <div className="relative">
        <ReactECharts option={option} style={{ height: 220 }} notMerge />
        {/* Positioned to match the ring's own center: [0] is the
            ring's "36%" center X, which is offset left of the box's
            true 50% midpoint to leave room for the legend on the
            right — this has to track that value, not the container's
            midpoint, or it drifts off-ring if the ring ever moves. */}
        <div
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: "36%", top: "50%" }}
        >
          <span className="text-lg font-medium text-charcoal">{formatGbpMillions(total)}</span>
          <span className="text-[10px] uppercase tracking-wide text-stone">Total sales</span>
        </div>
      </div>
    </div>
  );
}