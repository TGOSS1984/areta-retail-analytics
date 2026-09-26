"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchStoreContribution, type StoreContribution } from "@/lib/queries/marginsPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Box plot of store net contribution % by store type: the box is the
 * middle half of stores, the line in it the median, the whiskers stretch
 * to 1.5x the box height, and anything past them is drawn as its own dot
 * so the problem stores are named on hover. Averages would hide exactly
 * the spread this is for. */
export function ContributionBoxPlot() {
  const state = useFilteredData(fetchStoreContribution);
  return (
    <AsyncView state={state}>
      {(stores) => {
        const byType = new Map<string, StoreContribution[]>();
        for (const s of stores) byType.set(s.storeType, [...(byType.get(s.storeType) ?? []), s]);
        const types = Array.from(byType.keys()).sort(
          (a, b) =>
            quantile(byType.get(b)!.map((s) => s.pct).sort((x, y) => x - y), 0.5) -
            quantile(byType.get(a)!.map((s) => s.pct).sort((x, y) => x - y), 0.5),
        );
        const boxes: number[][] = [];
        const outliers: { value: [number, number]; store: StoreContribution }[] = [];
        types.forEach((type, i) => {
          const list = byType.get(type)!;
          const v = list.map((s) => s.pct * 100).sort((a, b) => a - b);
          const q1 = quantile(v, 0.25);
          const q3 = quantile(v, 0.75);
          const iqr = q3 - q1;
          const lowFence = q1 - 1.5 * iqr;
          const highFence = q3 + 1.5 * iqr;
          const inside = v.filter((x) => x >= lowFence && x <= highFence);
          boxes.push([Math.min(...inside), q1, quantile(v, 0.5), q3, Math.max(...inside)]);
          for (const s of list) {
            const x = s.pct * 100;
            if (x < lowFence || x > highFence) outliers.push({ value: [i, x], store: s });
          }
        });
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 40 : 48, right: 12, top: 16, bottom: compact ? 64 : 48 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "item",
                  formatter: (p: { seriesType: string; dataIndex: number; data: number[] | { store: StoreContribution } }) => {
                    if (p.seriesType === "scatter") {
                      const s = (p.data as { store: StoreContribution }).store;
                      return `${s.storeName}<br/>${s.market} · ${s.storeType}<br/>Net contribution ${(s.pct * 100).toFixed(1)}%`;
                    }
                    const b = boxes[p.dataIndex];
                    const n = byType.get(types[p.dataIndex])!.length;
                    return `${types[p.dataIndex]} · ${n} stores<br/>Median ${b[2].toFixed(1)}%<br/>Middle half ${b[1].toFixed(1)}% to ${b[3].toFixed(1)}%`;
                  },
                },
                xAxis: {
                  type: "category",
                  data: types,
                  axisLine,
                  axisLabel: { ...axisLabel, interval: 0, rotate: compact ? 35 : 20, fontSize: 10 },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { ...axisLabel, formatter: "{value}%" },
                  splitLine,
                },
                series: [
                  {
                    type: "boxplot",
                    data: boxes,
                    boxWidth: [8, compact ? 22 : 36],
                    itemStyle: { color: "rgba(31,116,134,0.35)", borderColor: COLORS.teal, borderWidth: 1.5 },
                    markLine: {
                      silent: true,
                      symbol: "none",
                      lineStyle: { color: COLORS.errorBright, type: "dashed" },
                      label: { color: COLORS.errorBright, fontSize: 10, formatter: "break-even" },
                      data: [{ yAxis: 0 }],
                    },
                  },
                  {
                    type: "scatter",
                    data: outliers,
                    symbolSize: 6,
                    itemStyle: { color: COLORS.gold, opacity: 0.85 },
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