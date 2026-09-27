"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchAtvByMarketChannel } from "@/lib/queries/customersPage";
import { COLORS, COMPACT_WIDTH, axisLabel, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount } from "@/lib/format";

const CHANNEL_COLORS: Record<string, string> = { Retail: COLORS.teal, Concession: COLORS.mist, Online: COLORS.gold };

/** Dot plot (a "dumbbell"): one row per market, a dot per channel for the
 * average spend per basket, and a line joining the lowest to the highest.
 * The length of the line is the gap between channels in that market,
 * which a grouped bar chart makes you work out for yourself. Built from a
 * transparent stacked bar for the joining line plus a scatter per channel. */
export function SpendDotPlot() {
  const state = useFilteredData(fetchAtvByMarketChannel);
  return (
    <AsyncView state={state}>
      {(cells) => {
        const volume = (m: string) => cells.filter((c) => c.market === m).reduce((a, c) => a + c.baskets, 0);
        const markets = Array.from(new Set(cells.map((c) => c.market))).sort((a, b) => volume(b) - volume(a));
        const channels = ["Retail", "Concession", "Online"].filter((ch) => cells.some((c) => c.channel === ch));
        const lo = markets.map((m) => Math.min(...cells.filter((c) => c.market === m).map((c) => c.atv)));
        const hi = markets.map((m) => Math.max(...cells.filter((c) => c.market === m).map((c) => c.atv)));
        const allAtv = cells.map((c) => c.atv);
        const axisMin = Math.floor((Math.min(...allAtv) - 5) / 10) * 10;
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 80 : 110, right: 16, top: 32, bottom: 24 },
                legend: { top: 0, right: 0, data: channels, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const m = markets[params[0]?.dataIndex ?? 0];
                    const rows = cells.filter((c) => c.market === m).sort((a, b) => b.atv - a.atv);
                    return [m, ...rows.map((c) => `${c.channel}: £${c.atv.toFixed(2)} (${formatCount(c.baskets)} baskets)`)].join("<br/>");
                  },
                },
                xAxis: { type: "value", min: Math.max(0, axisMin), axisLabel: { ...axisLabel, formatter: "£{value}" }, splitLine },
                yAxis: {
                  type: "category",
                  data: markets,
                  inverse: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: { ...axisLabel, width: compact ? 74 : 104, overflow: "truncate" },
                },
                series: [
                  { type: "bar", stack: "range", data: lo, itemStyle: { color: "transparent" }, silent: true, barWidth: 3, emphasis: { disabled: true } },
                  {
                    type: "bar",
                    stack: "range",
                    data: hi.map((h, i) => h - lo[i]),
                    barWidth: 3,
                    itemStyle: { color: "rgba(255,255,255,0.18)" },
                    silent: true,
                    emphasis: { disabled: true },
                  },
                  ...channels.map((ch) => ({
                    name: ch,
                    type: "scatter",
                    symbolSize: 11,
                    data: markets.map((m) => cells.find((c) => c.market === m && c.channel === ch)?.atv ?? null),
                    itemStyle: { color: CHANNEL_COLORS[ch] ?? COLORS.slate, borderColor: COLORS.deepTerrain, borderWidth: 1 },
                    z: 3,
                  })),
                ],
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}