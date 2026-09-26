"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { GroupRow } from "@/lib/queries/categoriesPage";
import { useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { COLORS, axisLabel, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";
import { groupTotals } from "@/components/categories/groupTotals";

const SHOW = 6;

/** Diverging bars: the six fastest-growing and six fastest-shrinking
 * product groups against last year. Thirty-odd bars would be a wall; the
 * two ends are where the questions are. */
export function GroupGrowthBars({ state }: { state: AsyncState<GroupRow[]> }) {
  const filters = useResolvedFilters();
  if (filters && !filters.hasLastYear) {
    return <EmptyState message="This is the first year of data, so there's no growth to show yet." />;
  }
  return (
    <AsyncView state={state}>
      {(rows) => {
        const growth = groupTotals(rows)
          .filter((g) => g.salesLy)
          .map((g) => ({ ...g, pct: (g.salesTy / (g.salesLy as number) - 1) * 100 }))
          .sort((a, b) => b.pct - a.pct);
        const picked =
          growth.length > SHOW * 2 ? [...growth.slice(0, SHOW), ...growth.slice(-SHOW)] : growth;
        return (
          <EChart
            build={(width) => ({
              grid: { left: width < 420 ? 110 : 150, right: 40, top: 4, bottom: 20 },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params: Array<{ dataIndex: number }>) => {
                  const g = picked[params[0]?.dataIndex ?? 0];
                  return `${g.productGroup}<br/>${g.pct >= 0 ? "+" : ""}${g.pct.toFixed(1)}%<br/>${formatGbpShort(g.salesLy ?? 0, 2)} → ${formatGbpShort(g.salesTy, 2)}`;
                },
              },
              xAxis: { type: "value", axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
              yAxis: {
                type: "category",
                data: picked.map((g) => g.productGroup),
                inverse: true,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { ...axisLabel, width: width < 420 ? 104 : 144, overflow: "truncate" },
              },
              series: [
                {
                  type: "bar",
                  data: picked.map((g) => ({
                    value: Number(g.pct.toFixed(2)),
                    itemStyle: { color: g.pct >= 0 ? COLORS.successBright : COLORS.errorBright, borderRadius: 2 },
                  })),
                  barMaxWidth: 16,
                  label: {
                    show: true,
                    position: "right",
                    color: COLORS.mist,
                    fontSize: 10,
                    formatter: (p: { value: number }) => `${p.value >= 0 ? "+" : ""}${p.value.toFixed(1)}%`,
                  },
                },
              ],
            })}
          />
        );
      }}
    </AsyncView>
  );
}