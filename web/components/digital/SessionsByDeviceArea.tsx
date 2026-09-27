"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchWeeklySessionsByDevice } from "@/lib/queries/digitalPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount } from "@/lib/format";

const DEVICE_COLORS: Record<string, string> = { Mobile: COLORS.gold, Desktop: COLORS.teal, Tablet: COLORS.mist };

/** Stacked area: weekly sessions split by device, so both the total and
 * the mix show in one chart. */
export function SessionsByDeviceArea() {
  const state = useFilteredData(fetchWeeklySessionsByDevice);
  return (
    <AsyncView state={state}>
      {(rows) => {
        const weeks = Array.from(new Set(rows.map((r) => r.week))).sort((a, b) => a - b);
        const devices = Array.from(new Set(rows.map((r) => r.device)));
        const devicesOrdered = ["Mobile", "Desktop", "Tablet"].filter((d) => devices.includes(d)).concat(devices.filter((d) => !DEVICE_COLORS[d]));
        const value = new Map(rows.map((r) => [`${r.week}|${r.device}`, r.sessions]));
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 40 : 52, right: 12, top: 32, bottom: 28 },
                legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  formatter: (params: Array<{ axisValue: string; seriesName: string; value: number; color: string }>) => {
                    const total = params.reduce((a, p) => a + (p.value ?? 0), 0);
                    return [params[0]?.axisValue, ...params.map((p) => `${p.seriesName}: ${formatCount(p.value)} (${total ? ((p.value / total) * 100).toFixed(0) : 0}%)`), `Total: ${formatCount(total)}`].join("<br/>");
                  },
                },
                xAxis: { type: "category", boundaryGap: false, data: weeks.map((w) => `Wk ${w}`), axisLine, axisLabel },
                yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatCount(v) }, splitLine },
                series: devicesOrdered.map((d) => ({
                  name: d,
                  type: "line",
                  stack: "sessions",
                  smooth: true,
                  showSymbol: false,
                  data: weeks.map((w) => value.get(`${w}|${d}`) ?? 0),
                  lineStyle: { width: 1, color: DEVICE_COLORS[d] ?? COLORS.slate },
                  itemStyle: { color: DEVICE_COLORS[d] ?? COLORS.slate },
                  areaStyle: { opacity: 0.55, color: DEVICE_COLORS[d] ?? COLORS.slate },
                })),
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}