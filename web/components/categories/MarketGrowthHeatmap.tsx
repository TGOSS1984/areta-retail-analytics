"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import { useFilteredData, useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { fetchMarketGroupGrowth, type MarketGroupCell } from "@/lib/queries/categoriesPage";
import { COLORS, COMPACT_WIDTH, DIVERGING, axisLabel, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

const CAP = 15;

/** Matrix heatmap of year-on-year growth: major group down the side,
 * market across the top, red for shrinking and green for growing. The
 * colour scale is capped at ±15% so one small cell with a wild swing
 * doesn't turn every other cell grey. Rows and columns are ordered by
 * size, so the cells that matter most sit top left. */
export function MarketGrowthHeatmap() {
  const filters = useResolvedFilters();
  const state = useFilteredData(fetchMarketGroupGrowth);
  if (filters && !filters.hasLastYear) {
    return <EmptyState message="This is the first year of data, so there's no growth to show yet." />;
  }
  return (
    <AsyncView state={state}>
      {(cells) => {
        const total = (key: "majorGroup" | "market", name: string) =>
          cells.filter((c) => c[key] === name).reduce((a, c) => a + c.salesTy, 0);
        const groups = Array.from(new Set(cells.map((c) => c.majorGroup))).sort((a, b) => total("majorGroup", b) - total("majorGroup", a));
        const markets = Array.from(new Set(cells.map((c) => c.market))).sort((a, b) => total("market", b) - total("market", a));
        // Each cell carries its own row in "cell" rather than as a fourth
        // array item, which ECharts would try to read as a number.
        const data = cells.map((c) => ({
          value: [
            markets.indexOf(c.market),
            groups.indexOf(c.majorGroup),
            c.salesLy ? Math.max(-CAP, Math.min(CAP, (c.salesTy / c.salesLy - 1) * 100)) : 0,
          ],
          cell: c,
        }));
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              const showLabels = width / Math.max(markets.length, 1) > 46;
              return {
                grid: { left: compact ? 84 : 132, right: 8, top: 8, bottom: compact ? 76 : 64 },
                tooltip: {
                  ...tooltipBase,
                  formatter: (p: { data: { cell: MarketGroupCell } }) => {
                    const c = p.data.cell;
                    const g = c.salesLy ? (c.salesTy / c.salesLy - 1) * 100 : null;
                    return `${c.majorGroup} · ${c.market}<br/>${formatGbpShort(c.salesTy, 1)}${g === null ? "" : ` (${g >= 0 ? "+" : ""}${g.toFixed(1)}% vs LY)`}`;
                  },
                },
                xAxis: {
                  type: "category",
                  data: markets,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: { ...axisLabel, interval: 0, rotate: 40, fontSize: 10 },
                },
                yAxis: {
                  type: "category",
                  data: groups,
                  inverse: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: { ...axisLabel, fontSize: compact ? 10 : 11, width: compact ? 78 : 124, overflow: "truncate" },
                },
                visualMap: {
                  min: -CAP,
                  max: CAP,
                  dimension: 2,
                  orient: "horizontal",
                  left: "center",
                  bottom: 0,
                  itemHeight: 120,
                  itemWidth: 8,
                  calculable: false,
                  text: [`+${CAP}%`, `-${CAP}%`],
                  textStyle: { color: COLORS.mist, fontSize: 10 },
                  inRange: { color: DIVERGING },
                },
                series: [
                  {
                    type: "heatmap",
                    data,
                    label: {
                      show: showLabels,
                      color: COLORS.cloud,
                      fontSize: 10,
                      formatter: (p: { data: { cell: MarketGroupCell } }) => {
                        const c = p.data.cell;
                        if (!c.salesLy) return "";
                        const g = (c.salesTy / c.salesLy - 1) * 100;
                        return `${g >= 0 ? "+" : ""}${g.toFixed(0)}%`;
                      },
                    },
                    itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 2, borderRadius: 3 },
                  },
                ],
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}