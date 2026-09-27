"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchMarketDeviceConversion, type MarketDeviceCell } from "@/lib/queries/digitalPage";
import { COLORS, COMPACT_WIDTH, HEAT_SCALE, axisLabel, tooltipBase } from "@/lib/chartTheme";
import { formatCount } from "@/lib/format";

/** Heatmap of conversion by market and device. Markets sorted by
 * traffic, so the ones that matter most are at the top; a pale cell in a
 * busy row is a checkout worth looking at. */
export function MarketDeviceHeatmap() {
  const state = useFilteredData(fetchMarketDeviceConversion);
  return (
    <AsyncView state={state}>
      {(cells) => {
        const traffic = (m: string) => cells.filter((c) => c.market === m).reduce((a, c) => a + c.sessions, 0);
        const markets = Array.from(new Set(cells.map((c) => c.market))).sort((a, b) => traffic(b) - traffic(a));
        const devices = ["Mobile", "Desktop", "Tablet"].filter((d) => cells.some((c) => c.device === d));
        const values = cells.map((c) => c.conversion * 100);
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 80 : 110, right: 8, top: 24, bottom: 40 },
                tooltip: {
                  ...tooltipBase,
                  formatter: (p: { data: { cell: MarketDeviceCell } }) =>
                    `${p.data.cell.market} · ${p.data.cell.device}<br/>${(p.data.cell.conversion * 100).toFixed(2)}% of ${formatCount(p.data.cell.sessions)} sessions`,
                },
                xAxis: { type: "category", position: "top", data: devices, axisLine: { show: false }, axisTick: { show: false }, axisLabel },
                yAxis: {
                  type: "category",
                  data: markets,
                  inverse: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel: { ...axisLabel, width: compact ? 74 : 104, overflow: "truncate" },
                },
                visualMap: {
                  min: Math.min(...values),
                  max: Math.max(...values),
                  dimension: 2,
                  orient: "horizontal",
                  left: "center",
                  bottom: 0,
                  itemHeight: 120,
                  itemWidth: 8,
                  calculable: false,
                  text: ["Converts better", "Worse"],
                  textStyle: { color: COLORS.mist, fontSize: 10 },
                  inRange: { color: HEAT_SCALE },
                },
                series: [
                  {
                    type: "heatmap",
                    data: cells.map((c) => ({ value: [devices.indexOf(c.device), markets.indexOf(c.market), c.conversion * 100], cell: c })),
                    label: {
                      show: true,
                      color: COLORS.cloud,
                      fontSize: 10,
                      formatter: (p: { data: { cell: MarketDeviceCell } }) => `${(p.data.cell.conversion * 100).toFixed(1)}%`,
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