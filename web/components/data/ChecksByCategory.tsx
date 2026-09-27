"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DqCheck } from "@/lib/queries/dataPage";
import { COLORS, axisLabel, splitLine, tooltipBase } from "@/lib/chartTheme";

/** Stacked bars: how many checks in each category passed, warned or
 * failed. Cleaning is left out: its checks report what was fixed, not a
 * pass or fail. */
export function ChecksByCategory({ state }: { state: AsyncState<DqCheck[]> }) {
  return (
    <AsyncView state={state}>
      {(checks) => {
        const scored = checks.filter((c) => c.countsTowardScore);
        const categories = Array.from(new Map(scored.map((c) => [c.category, c.categoryOrder])).entries())
          .sort((a, b) => a[1] - b[1])
          .map(([c]) => c);
        const count = (cat: string, status: string) => scored.filter((c) => c.category === cat && c.status === status).length;
        const series = [
          { name: "Pass", color: COLORS.successBright },
          { name: "Warn", color: "#F9A825" },
          { name: "Fail", color: COLORS.errorBright },
        ];
        return (
          <EChart
            build={() => ({
              grid: { left: 100, right: 24, top: 28, bottom: 20 },
              legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
              tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" } },
              xAxis: { type: "value", minInterval: 1, axisLabel, splitLine },
              yAxis: { type: "category", data: categories, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel },
              series: series.map((s) => ({
                name: s.name,
                type: "bar",
                stack: "checks",
                barMaxWidth: 16,
                data: categories.map((c) => count(c, s.name) || null),
                itemStyle: { color: s.color },
                label: { show: true, color: COLORS.deepTerrain, fontSize: 10, fontWeight: 500 },
              })),
            })}
          />
        );
      }}
    </AsyncView>
  );
}