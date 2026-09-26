"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StyleSales } from "@/lib/queries/productsPage";
import { COLORS, PALETTE, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Treemap: each brand's block split into its product groups, area by
 * sales. Click a brand to zoom into it; the breadcrumb takes you back. */
export function BrandTreemap({ state }: { state: AsyncState<StyleSales[]> }) {
  return (
    <AsyncView state={state}>
      {(styles) => {
        const byBrand = new Map<string, Map<string, number>>();
        for (const s of styles) {
          const groups = byBrand.get(s.brand) ?? new Map<string, number>();
          groups.set(s.productGroup, (groups.get(s.productGroup) ?? 0) + s.sales);
          byBrand.set(s.brand, groups);
        }
        const total = styles.reduce((a, s) => a + s.sales, 0);
        const data = Array.from(byBrand.entries())
          .map(([brand, groups], i) => ({
            name: brand,
            value: Array.from(groups.values()).reduce((a, v) => a + v, 0),
            itemStyle: { color: PALETTE[i % PALETTE.length] },
            children: Array.from(groups.entries()).map(([name, value]) => ({ name, value })),
          }))
          .sort((a, b) => b.value - a.value);
        return (
          <EChart
            build={() => ({
              tooltip: {
                ...tooltipBase,
                formatter: (p: { name: string; value: number; treePathInfo: { name: string }[] }) => {
                  const path = p.treePathInfo.map((x) => x.name).filter(Boolean).join(" › ");
                  return `${path}<br/>${formatGbpShort(p.value, 2)} · ${((p.value / total) * 100).toFixed(1)}% of sales`;
                },
              },
              series: [
                {
                  type: "treemap",
                  data,
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 24,
                  roam: false,
                  nodeClick: "zoomToNode",
                  breadcrumb: {
                    bottom: 0,
                    height: 18,
                    itemStyle: { color: COLORS.deepTerrain, borderColor: "rgba(255,255,255,0.15)", textStyle: { color: COLORS.cloud } },
                  },
                  label: { color: COLORS.cloud, fontSize: 11, overflow: "truncate" },
                  upperLabel: { show: true, height: 20, color: COLORS.cloud, fontSize: 11 },
                  itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 2, gapWidth: 2 },
                  levels: [
                    { itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 3, gapWidth: 3 } },
                    { colorSaturation: [0.25, 0.6], itemStyle: { borderColorSaturation: 0.3, gapWidth: 1 } },
                  ],
                },
              ],
            })}
          />
        );
      }}
    </AsyncView>
  );
}