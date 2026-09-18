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
 * reusable for whatever the next mix-style breakdown turns out to be.
 *
 * Sized by its parent, not a hardcoded height: the ECharts instance is
 * height:100% of a flex-1 wrapper, and the card root is h-full — so
 * whatever box the caller's layout gives this component (a full grid
 * row in CategoryMixChart's case, half a row split with an image panel
 * in ChannelMixChart's case), the ring and legend fill it, rather than
 * this component guessing two different pixel heights for two
 * different contexts. */
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
      textStyle: { color: "#8D9AA1", fontSize: 11 },
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
        // Slice-gap border matches the card's own background
        // (deep-terrain) rather than white, so gaps between slices
        // blend into the card instead of standing out as bright rings.
        itemStyle: { borderColor: "#003744", borderWidth: 2 },
        data: slices.map((s, i) => ({
          name: s.label,
          value: s.salesGbp,
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-deep-terrain p-5">
      <h2 className="mb-2 flex-shrink-0 text-sm font-medium text-cloud">{title}</h2>
      <div className="relative min-h-0 flex-1">
        <ReactECharts option={option} style={{ height: "100%" }} notMerge />
        {/* Positioned to match the ring's own center: [0] is the
            ring's "36%" center X, which is offset left of the box's
            true 50% midpoint to leave room for the legend on the
            right — this has to track that value, not the container's
            midpoint, or it drifts off-ring if the ring ever moves. */}
        <div
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: "36%", top: "50%" }}
        >
          <span className="text-lg font-medium text-cloud">{formatGbpMillions(total)}</span>
          <span className="text-[10px] uppercase tracking-wide text-mist">Total sales</span>
        </div>
      </div>
    </div>
  );
}