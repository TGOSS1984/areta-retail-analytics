"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchFootfallRhythm } from "@/lib/queries/storesPage";
import { COLORS, COMPACT_WIDTH, HEAT_SCALE, axisLabel, tooltipBase } from "@/lib/chartTheme";
import { formatCount } from "@/lib/format";

/** Heatmap of average daily footfall by weekday and business period: the
 * weekend peak and the seasonal build in one picture. Useful for staff
 * rotas, which is exactly the question a store manager brings to it. */
export function FootfallRhythmHeatmap() {
  const state = useFilteredData(fetchFootfallRhythm);
  return (
    <AsyncView state={state}>
      {(cells) => {
        const periods = Array.from(new Set(cells.map((c) => c.period))).sort((a, b) => a - b);
        const days = Array.from(new Map(cells.map((c) => [c.dow, c.dayName])).entries()).sort((a, b) => a[0] - b[0]);
        const values = cells.map((c) => c.avgFootfall);
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              const showLabels = width / Math.max(periods.length, 1) > 44;
              return {
                grid: { left: compact ? 36 : 44, right: 8, top: 8, bottom: 48 },
                tooltip: {
                  ...tooltipBase,
                  formatter: (p: { value: [number, number, number] }) =>
                    `${days[p.value[1]][1]}, P${String(periods[p.value[0]]).padStart(2, "0")}<br/>${formatCount(p.value[2])} visitors a day on average`,
                },
                xAxis: {
                  type: "category",
                  data: periods.map((p) => `P${String(p).padStart(2, "0")}`),
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel,
                  splitArea: { show: false },
                },
                yAxis: {
                  type: "category",
                  data: days.map(([, name]) => (compact ? name.slice(0, 1) : name.slice(0, 3))),
                  inverse: true,
                  axisLine: { show: false },
                  axisTick: { show: false },
                  axisLabel,
                },
                visualMap: {
                  min: Math.min(...values),
                  max: Math.max(...values),
                  orient: "horizontal",
                  left: "center",
                  bottom: 0,
                  itemHeight: 120,
                  itemWidth: 8,
                  calculable: false,
                  text: ["Busier", "Quieter"],
                  textStyle: { color: COLORS.mist, fontSize: 10 },
                  inRange: { color: HEAT_SCALE },
                },
                series: [
                  {
                    type: "heatmap",
                    data: cells.map((c) => [periods.indexOf(c.period), days.findIndex(([d]) => d === c.dow), c.avgFootfall]),
                    label: {
                      show: showLabels,
                      color: COLORS.cloud,
                      fontSize: 10,
                      formatter: (p: { value: [number, number, number] }) => formatCount(p.value[2]),
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