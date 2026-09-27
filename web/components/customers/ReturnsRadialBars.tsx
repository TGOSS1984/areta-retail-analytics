"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchReturnsByGroup } from "@/lib/queries/customersPage";
import { COLORS, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Radial bars: return rate by major group, one ring per group wrapping
 * round a polar axis, highest rate on the outside. The longest ring is
 * set to three-quarters of a circle so the lengths stay easy to compare
 * by eye. Last year is in the tooltip rather than a second ring: two
 * rings per group made fourteen thin ones and the labels piled up. The
 * note under it matters: the generator draws returns at a flat rate, so
 * the differences here are small and mostly noise, and the chart says so
 * rather than implying otherwise. */
export function ReturnsRadialBars() {
  const state = useFilteredData(fetchReturnsByGroup);
  return (
    <AsyncView state={state}>
      {(rows) => {
        // Lowest rate on the inside, highest on the outside.
        const ordered = [...rows].sort((a, b) => a.rate - b.rate);
        const max = Math.max(...ordered.map((r) => r.rate)) * 100;
        return (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <EChart
                build={(width) => {
                  const narrow = width < 420;
                  return {
                    tooltip: {
                      ...tooltipBase,
                      trigger: "item",
                      formatter: (p: { dataIndex: number }) => {
                        const r = ordered[p.dataIndex];
                        return `${r.majorGroup}<br/>${(r.rate * 100).toFixed(2)}% of sales returned${
                          r.rateLy === null ? "" : `<br/>Last year ${(r.rateLy * 100).toFixed(2)}%`
                        }<br/>${formatGbpShort(r.returned, 1)} refunded`;
                      },
                    },
                    polar: { radius: ["22%", narrow ? "82%" : "88%"], center: ["50%", "52%"] },
                    angleAxis: { max: max / 0.75, startAngle: 90, show: false },
                    radiusAxis: {
                      type: "category",
                      data: ordered.map((r) => r.majorGroup),
                      axisLine: { show: false },
                      axisTick: { show: false },
                      // Labels sit at 12 o'clock, just left of where each
                      // ring starts, reading like a legend for the rings.
                      axisLabel: { show: !narrow, color: COLORS.mist, fontSize: 10, interval: 0, margin: 8 },
                    },
                    series: [
                      {
                        type: "bar",
                        coordinateSystem: "polar",
                        data: ordered.map((r) => Number((r.rate * 100).toFixed(2))),
                        barCategoryGap: "28%",
                        roundCap: true,
                        itemStyle: { color: COLORS.gold },
                        showBackground: true,
                        backgroundStyle: { color: "rgba(255,255,255,0.05)" },
                        label: {
                          show: true,
                          position: "end",
                          color: COLORS.cloud,
                          fontSize: 10,
                          formatter: (p: { value: number; dataIndex: number }) =>
                            narrow ? `${ordered[p.dataIndex].majorGroup} ${p.value.toFixed(1)}%` : `${p.value.toFixed(1)}%`,
                        },
                      },
                    ],
                  };
                }}
              />
            </div>
            <p className="mt-1 flex-shrink-0 text-[10px] text-mist">
              Hover a ring for last year. Rates are close across categories because the sales generator draws returns at a flat rate.
            </p>
          </div>
        );
      }}
    </AsyncView>
  );
}