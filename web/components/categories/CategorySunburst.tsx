"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { GroupRow } from "@/lib/queries/categoriesPage";
import { COLORS, PALETTE, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Sunburst of the range: division in the middle, major group next,
 * product group on the outside, each ring sized by sales. Click a slice
 * to zoom into it, click the centre to come back out. */
export function CategorySunburst({ state }: { state: AsyncState<GroupRow[]> }) {
  return (
    <AsyncView state={state}>
      {(rows) => {
        const total = rows.reduce((a, r) => a + r.salesTy, 0);
        const divisions = new Map<string, Map<string, { name: string; value: number }[]>>();
        for (const r of rows) {
          if (r.salesTy <= 0) continue;
          const majors = divisions.get(r.division) ?? new Map();
          const groups = majors.get(r.majorGroup) ?? [];
          groups.push({ name: r.productGroup, value: r.salesTy });
          majors.set(r.majorGroup, groups);
          divisions.set(r.division, majors);
        }
        let colourIndex = 0;
        const data = Array.from(divisions.entries()).map(([division, majors]) => ({
          name: division,
          itemStyle: { color: COLORS.slate },
          children: Array.from(majors.entries()).map(([major, groups]) => ({
            name: major,
            itemStyle: { color: PALETTE[colourIndex++ % PALETTE.length] },
            children: groups.sort((a, b) => b.value - a.value),
          })),
        }));
        return (
          <EChart
            build={(width) => ({
              tooltip: {
                ...tooltipBase,
                formatter: (p: { treePathInfo: { name: string }[]; value: number }) =>
                  `${p.treePathInfo.map((x) => x.name).filter(Boolean).join(" › ")}<br/>${formatGbpShort(p.value, 2)} · ${((p.value / total) * 100).toFixed(1)}%`,
              },
              series: [
                {
                  type: "sunburst",
                  data,
                  radius: ["12%", "94%"],
                  nodeClick: "rootToNode",
                  itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 1.5 },
                  label: { color: COLORS.cloud, fontSize: 10, minAngle: 8 },
                  levels: [
                    {},
                    { r0: "12%", r: "30%", label: { rotate: 0, fontSize: 10 } },
                    { r0: "30%", r: "60%", label: { rotate: "tangential", fontSize: width < 420 ? 9 : 10 } },
                    { r0: "60%", r: "94%", label: { show: width >= 420, align: "right", fontSize: 9 }, itemStyle: { opacity: 0.85 } },
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