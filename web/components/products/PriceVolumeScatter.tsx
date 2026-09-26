"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StyleSales } from "@/lib/queries/productsPage";
import { COLORS, COMPACT_WIDTH, PALETTE, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount, formatGbpShort } from "@/lib/format";

/** Bubble scatter: each style's average selling price against units sold,
 * sized by sales and coloured by brand. Units go on a log scale because
 * they run from a handful to thousands; on a straight scale every style
 * below the top few would sit in one flat line along the bottom. */
export function PriceVolumeScatter({ state }: { state: AsyncState<StyleSales[]> }) {
  return (
    <AsyncView state={state}>
      {(styles) => {
        const brands = Array.from(new Set(styles.map((s) => s.brand))).sort();
        const maxSales = Math.max(...styles.map((s) => s.sales), 1);
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 40 : 48, right: 16, top: compact ? 44 : 32, bottom: 36 },
                legend: {
                  top: 0,
                  left: compact ? 0 : undefined,
                  right: compact ? undefined : 0,
                  textStyle: { color: COLORS.mist, fontSize: 11 },
                  itemWidth: 10,
                  itemHeight: 10,
                },
                tooltip: {
                  ...tooltipBase,
                  formatter: (p: { data: { style: StyleSales } }) => {
                    const s = p.data.style;
                    return `${s.styleName}<br/>${s.brand} · ${s.productGroup}<br/>£${(s.sales / s.units).toFixed(2)} avg · ${formatCount(s.units)} units<br/>${formatGbpShort(s.sales, 1)}`;
                  },
                },
                xAxis: {
                  type: "value",
                  name: "Average selling price",
                  nameLocation: "middle",
                  nameGap: 24,
                  nameTextStyle: { color: COLORS.mist, fontSize: 10 },
                  axisLabel: { ...axisLabel, formatter: "£{value}" },
                  axisLine,
                  splitLine,
                },
                yAxis: {
                  type: "log",
                  axisLabel: { ...axisLabel, formatter: (v: number) => formatCount(v) },
                  splitLine,
                },
                series: brands.map((brand, i) => ({
                  name: brand,
                  type: "scatter",
                  data: styles
                    .filter((s) => s.brand === brand && s.units > 0)
                    .map((s) => ({ value: [s.sales / s.units, s.units], style: s })),
                  symbolSize: (_: unknown, p: { data: { style: StyleSales } }) =>
                    4 + Math.sqrt(p.data.style.sales / maxSales) * (compact ? 14 : 22),
                  itemStyle: { color: PALETTE[i % PALETTE.length], opacity: 0.7, borderColor: COLORS.deepTerrain },
                })),
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}