"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchReturnsByGroup } from "@/lib/queries/customersPage";
import { COLORS, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Radial bars: return rate by major group, this year in gold and last
 * year in grey, wrapped round a circle on a polar axis. The note under it
 * matters: the generator draws returns at a flat rate, so the differences
 * here are small and mostly noise, and the chart says so rather than
 * implying otherwise. */
export function ReturnsRadialBars() {
  const state = useFilteredData(fetchReturnsByGroup);
  return (
    <AsyncView state={state}>
      {(rows) => {
        const max = Math.max(...rows.map((r) => Math.max(r.rate, r.rateLy ?? 0))) * 100;
        const hasLy = rows.some((r) => r.rateLy !== null);
        return (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <EChart
                build={(width) => ({
                  legend: hasLy
                    ? { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 }
                    : undefined,
                  tooltip: {
                    ...tooltipBase,
                    trigger: "axis",
                    formatter: (params: Array<{ dataIndex: number }>) => {
                      const r = rows[params[0]?.dataIndex ?? 0];
                      return `${r.majorGroup}<br/>${(r.rate * 100).toFixed(2)}% returned${
                        r.rateLy === null ? "" : ` (LY ${(r.rateLy * 100).toFixed(2)}%)`
                      }<br/>${formatGbpShort(r.returned, 1)} refunded`;
                    },
                  },
                  polar: { radius: ["18%", width < 420 ? "74%" : "80%"], center: ["50%", "54%"] },
                  angleAxis: { max: Math.ceil(max * 1.15 * 10) / 10, startAngle: 90, show: false },
                  radiusAxis: {
                    type: "category",
                    data: rows.map((r) => r.majorGroup),
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: width >= 360, color: COLORS.mist, fontSize: 10, interval: 0 },
                  },
                  series: [
                    {
                      name: "This year",
                      type: "bar",
                      coordinateSystem: "polar",
                      data: rows.map((r) => r.rate * 100),
                      itemStyle: { color: COLORS.gold, borderRadius: 4 },
                      barWidth: hasLy ? 7 : 12,
                      roundCap: true,
                      label: {
                        show: true,
                        position: "end",
                        color: COLORS.cloud,
                        fontSize: 10,
                        formatter: (p: { value: number }) => `${p.value.toFixed(1)}%`,
                      },
                    },
                    ...(hasLy
                      ? [
                          {
                            name: "Last year",
                            type: "bar",
                            coordinateSystem: "polar",
                            data: rows.map((r) => (r.rateLy === null ? 0 : r.rateLy * 100)),
                            itemStyle: { color: "rgba(141,154,161,0.55)", borderRadius: 4 },
                            barWidth: 7,
                            roundCap: true,
                          },
                        ]
                      : []),
                  ],
                })}
              />
            </div>
            <p className="mt-1 flex-shrink-0 text-[10px] text-mist">
              Return rates are close across categories because the sales generator draws returns at a flat rate.
            </p>
          </div>
        );
      }}
    </AsyncView>
  );
}