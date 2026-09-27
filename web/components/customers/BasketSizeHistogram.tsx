"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchBasketSizes } from "@/lib/queries/customersPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount, formatGbpShort } from "@/lib/format";

/** Histogram of basket sizes (items per trip), with each size's share of
 * sales laid over it. The gap between the two is the point: small baskets
 * are most of the trips, but the bigger ones punch well above their
 * number in sales. */
export function BasketSizeHistogram() {
  const state = useFilteredData(fetchBasketSizes);
  return (
    <AsyncView state={state}>
      {(rows) => {
        const baskets = rows.reduce((a, r) => a + r.baskets, 0);
        const sales = rows.reduce((a, r) => a + r.sales, 0);
        const labels = rows.map((r) => (r.size >= 8 ? "8+" : String(r.size)));
        const basketShare = rows.map((r) => (baskets ? (r.baskets / baskets) * 100 : 0));
        const salesShare = rows.map((r) => (sales ? (r.sales / sales) * 100 : 0));
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 36 : 44, right: 12, top: 32, bottom: 36 },
                legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const i = params[0]?.dataIndex ?? 0;
                    const r = rows[i];
                    return `${labels[i]} item${labels[i] === "1" ? "" : "s"}<br/>${formatCount(r.baskets)} baskets (${basketShare[i].toFixed(1)}%)<br/>${formatGbpShort(r.sales, 2)} (${salesShare[i].toFixed(1)}% of sales)<br/>£${(r.sales / Math.max(r.baskets, 1)).toFixed(2)} a basket`;
                  },
                },
                xAxis: {
                  type: "category",
                  data: labels,
                  axisLine,
                  axisLabel,
                  name: "Items in the basket",
                  nameLocation: "middle",
                  nameGap: 24,
                  nameTextStyle: { color: COLORS.mist, fontSize: 10 },
                },
                yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine },
                series: [
                  {
                    name: "Share of baskets",
                    type: "bar",
                    data: basketShare,
                    barCategoryGap: "12%",
                    itemStyle: { color: COLORS.teal, borderRadius: [3, 3, 0, 0] },
                  },
                  {
                    name: "Share of sales",
                    type: "line",
                    data: salesShare,
                    symbolSize: 7,
                    lineStyle: { color: COLORS.gold, width: 2 },
                    itemStyle: { color: COLORS.gold },
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