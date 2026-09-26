"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StyleSales } from "@/lib/queries/productsPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Pareto: every style as a bar, best first, with the running share of
 * sales as a line on its own axis. The styles that make up the first 80%
 * are gold and the tail is grey, and a marker says how many it took, so
 * the chart answers "how much of the range does the work?" at a glance. */
export function StyleParetoChart({ state }: { state: AsyncState<StyleSales[]> }) {
  return (
    <AsyncView state={state}>
      {(styles) => {
        const total = styles.reduce((s, x) => s + x.sales, 0);
        let running = 0;
        const cumulative = styles.map((s) => {
          running += s.sales;
          return total ? (running / total) * 100 : 0;
        });
        const cutoff = cumulative.findIndex((c) => c >= 80);
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 44 : 56, right: compact ? 36 : 44, top: 28, bottom: 24 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  axisPointer: { type: "line" },
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const i = params[0]?.dataIndex ?? 0;
                    const s = styles[i];
                    return `#${i + 1} ${s.styleName}<br/>${s.brand} · ${s.productGroup}<br/>${formatGbpShort(s.sales, 1)} · ${cumulative[i].toFixed(1)}% of sales so far`;
                  },
                },
                xAxis: {
                  type: "category",
                  // Strings, so the marker below can name its category exactly.
                  data: styles.map((_, i) => String(i + 1)),
                  axisLine,
                  axisTick: { show: false },
                  axisLabel: { ...axisLabel, interval: Math.max(0, Math.floor(styles.length / (compact ? 4 : 8)) - 1) },
                  name: "Styles, best to worst",
                  nameLocation: "middle",
                  nameGap: 4,
                  nameTextStyle: { color: "transparent" },
                },
                yAxis: [
                  { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 0) }, splitLine },
                  { type: "value", min: 0, max: 100, axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine: { show: false } },
                ],
                series: [
                  {
                    type: "bar",
                    data: styles.map((s, i) => ({
                      value: s.sales,
                      itemStyle: { color: i <= cutoff ? COLORS.gold : "rgba(141,154,161,0.45)" },
                    })),
                    barCategoryGap: 0,
                    large: true,
                  },
                  {
                    type: "line",
                    yAxisIndex: 1,
                    data: cumulative,
                    showSymbol: false,
                    lineStyle: { color: COLORS.cloud, width: 2 },
                    markLine: {
                      silent: true,
                      symbol: "none",
                      lineStyle: { color: COLORS.teal, type: "dashed" },
                      label: { color: COLORS.cloud, fontSize: 11, position: "insideEndTop" },
                      data: [
                        { yAxis: 80, label: { formatter: "80% of sales" } },
                        {
                          xAxis: String(cutoff + 1),
                          label: {
                            formatter: `${cutoff + 1} of ${styles.length} styles (${(((cutoff + 1) / styles.length) * 100).toFixed(0)}%)`,
                            position: "insideEndBottom",
                          },
                        },
                      ],
                    },
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