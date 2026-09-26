"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchChannelFlows } from "@/lib/queries/categoriesPage";
import { COLORS, PALETTE, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

const CHANNEL_COLORS: Record<string, string> = { Retail: COLORS.teal, Concession: COLORS.slate, Online: COLORS.gold };

/** Sankey: how each channel's sales split across the major groups. It
 * shows at a glance whether a category leans on one channel, which a
 * table of the same numbers hides. */
export function ChannelSankey() {
  const state = useFilteredData(fetchChannelFlows);
  return (
    <AsyncView state={state}>
      {(flows) => {
        const channels = Array.from(new Set(flows.map((f) => f.channel)));
        const groups = Array.from(new Set(flows.map((f) => f.majorGroup)));
        const total = flows.reduce((a, f) => a + f.sales, 0);
        return (
          <EChart
            build={(width) => ({
              tooltip: {
                ...tooltipBase,
                formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
                  p.dataType === "edge"
                    ? `${p.data.source} → ${p.data.target}<br/>${formatGbpShort(p.value, 2)} · ${((p.value / total) * 100).toFixed(1)}%`
                    : `${p.name}<br/>${formatGbpShort(p.value, 2)}`,
              },
              series: [
                {
                  type: "sankey",
                  left: 8,
                  right: width < 480 ? 96 : 140,
                  top: 8,
                  bottom: 8,
                  nodeWidth: 12,
                  nodeGap: 8,
                  draggable: false,
                  emphasis: { focus: "adjacency" },
                  label: { color: COLORS.cloud, fontSize: width < 480 ? 10 : 11 },
                  lineStyle: { color: "gradient", opacity: 0.35, curveness: 0.5 },
                  data: [
                    ...channels.map((c) => ({ name: c, itemStyle: { color: CHANNEL_COLORS[c] ?? COLORS.mist } })),
                    ...groups.map((g, i) => ({ name: g, itemStyle: { color: PALETTE[(i + 2) % PALETTE.length] } })),
                  ],
                  links: flows.map((f) => ({ source: f.channel, target: f.majorGroup, value: f.sales })),
                },
              ],
            })}
          />
        );
      }}
    </AsyncView>
  );
}