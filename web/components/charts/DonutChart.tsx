"use client";

import type { MixSlice } from "@/lib/queries/salesMix";
import { EChart } from "@/components/charts/base/EChart";
import { formatGbpMillions } from "@/lib/format";
import { COLORS, tooltipBase } from "@/lib/chartTheme";

const PALETTE = [COLORS.teal, COLORS.gold, COLORS.slate, COLORS.mist, COLORS.success];

type TooltipParams = { name: string; value: number; percent: number };

type DonutChartProps = {
  title: string;
  slices: MixSlice[];
};

/** Shared by category mix and channel mix. Sized by its parent. When the
 * card is wide the legend sits to the right of the ring; when it's narrow
 * (a phone, or a squeezed tablet column) the ring centres and the legend
 * moves underneath, so the two never overlap. The total in the middle is
 * an ECharts title placed on the ring's own centre, so it moves with it. */
export function DonutChart({ title, slices }: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.salesGbp, 0);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-deep-terrain p-4 md:p-5">
      <h2 className="mb-2 flex-shrink-0 text-sm font-medium text-cloud">{title}</h2>
      <div className="min-h-0 flex-1">
        <EChart
          build={(width) => {
            const stacked = width < 380;
            const centreX = stacked ? "50%" : "36%";
            const centreY = stacked ? "42%" : "50%";
            return {
              tooltip: {
                ...tooltipBase,
                trigger: "item",
                formatter: (p: TooltipParams) => `${p.name}: ${formatGbpMillions(p.value)} (${p.percent}%)`,
              },
              legend: stacked
                ? { orient: "horizontal", bottom: 0, left: "center", textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 }
                : { orient: "vertical", right: 0, top: "middle", textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
              title: {
                text: formatGbpMillions(total),
                subtext: "TOTAL SALES",
                left: centreX,
                top: centreY,
                textAlign: "center",
                textVerticalAlign: "middle",
                itemGap: 2,
                textStyle: { color: COLORS.cloud, fontSize: 16, fontWeight: 500 },
                subtextStyle: { color: COLORS.mist, fontSize: 9 },
              },
              series: [
                {
                  type: "pie",
                  radius: stacked ? ["50%", "72%"] : ["55%", "80%"],
                  center: [centreX, centreY],
                  avoidLabelOverlap: true,
                  label: { show: false },
                  // Gap borders match the card, so gaps blend in rather
                  // than showing as bright rings.
                  itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 2 },
                  data: slices.map((s, i) => ({
                    name: s.label,
                    value: s.salesGbp,
                    itemStyle: { color: PALETTE[i % PALETTE.length] },
                  })),
                },
              ],
            };
          }}
        />
      </div>
    </div>
  );
}