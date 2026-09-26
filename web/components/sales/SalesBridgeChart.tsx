"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import { useFilteredData, useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { fetchSalesBridge } from "@/lib/queries/salesPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Waterfall from last year's sales to this year's, one step per market
 * (or per channel when a single market is selected). ECharts has no
 * waterfall type, so it's the usual stacked-bar build: an invisible bar
 * lifts each visible one to where the running total already is. On a
 * narrow screen it turns on its side so the market names stay readable. */
export function SalesBridgeChart() {
  const filters = useResolvedFilters();
  const state = useFilteredData(fetchSalesBridge);

  if (filters && !filters.hasLastYear) {
    return <EmptyState message="This is the first year of data, so there's no last year to bridge from." />;
  }

  return (
    <AsyncView state={state}>
      {({ steps }) => {
        const lyTotal = steps.reduce((s, x) => s + x.ly, 0);
        const tyTotal = steps.reduce((s, x) => s + x.ty, 0);
        const labels = ["Last year", ...steps.map((s) => s.label), "This year"];
        const base: (number | null)[] = [0];
        const up: (number | null)[] = [lyTotal];
        const down: (number | null)[] = [null];
        let running = lyTotal;
        for (const s of steps) {
          const delta = s.ty - s.ly;
          if (delta >= 0) {
            base.push(running);
            up.push(delta);
            down.push(null);
          } else {
            base.push(running + delta);
            up.push(null);
            down.push(-delta);
          }
          running += delta;
        }
        base.push(0);
        up.push(tyTotal);
        down.push(null);
        // Zoom the value axis to where the movement is: starting at zero
        // would make every market step a sliver next to two huge totals.
        const lows = base.slice(1, -1).map((b) => b ?? 0);
        const floor = Math.max(0, Math.min(...lows, lyTotal, tyTotal) * 0.97);

        return (
          <EChart
            build={(width) => {
              const horizontal = width < COMPACT_WIDTH;
              const categoryAxis = {
                type: "category",
                data: labels,
                axisLine,
                axisLabel: { ...axisLabel, interval: 0, rotate: horizontal ? 0 : 35, fontSize: 10 },
                inverse: horizontal,
              };
              const valueAxis = {
                type: "value",
                min: floor,
                axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 1) },
                splitLine,
              };
              const colourFor = (i: number) => (i === 0 || i === labels.length - 1 ? COLORS.teal : COLORS.successBright);
              return {
                grid: horizontal
                  ? { left: 96, right: 16, top: 8, bottom: 24 }
                  : { left: 56, right: 12, top: 16, bottom: 64 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const i = params[0]?.dataIndex ?? 0;
                    if (i === 0) return `Last year<br/>${formatGbpShort(lyTotal, 2)}`;
                    if (i === labels.length - 1) return `This year<br/>${formatGbpShort(tyTotal, 2)}`;
                    const s = steps[i - 1];
                    const delta = s.ty - s.ly;
                    return `${s.label}<br/>${delta >= 0 ? "+" : ""}${formatGbpShort(delta, 1)} (${s.ly ? ((delta / s.ly) * 100).toFixed(1) : "–"}%)<br/>${formatGbpShort(s.ly, 2)} → ${formatGbpShort(s.ty, 2)}`;
                  },
                },
                xAxis: horizontal ? valueAxis : categoryAxis,
                yAxis: horizontal ? categoryAxis : valueAxis,
                series: [
                  { type: "bar", stack: "w", data: base, itemStyle: { color: "transparent" }, emphasis: { disabled: true }, silent: true },
                  {
                    name: "Increase",
                    type: "bar",
                    stack: "w",
                    data: up.map((v, i) => (v === null ? null : { value: v, itemStyle: { color: colourFor(i) } })),
                    barMaxWidth: 34,
                    itemStyle: { borderRadius: 2 },
                  },
                  {
                    name: "Decrease",
                    type: "bar",
                    stack: "w",
                    data: down,
                    barMaxWidth: 34,
                    itemStyle: { color: COLORS.errorBright, borderRadius: 2 },
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