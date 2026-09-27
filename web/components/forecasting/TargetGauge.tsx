"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { Forecast } from "@/lib/queries/forecastPage";
import { COLORS } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

/** Gauge of projected full-year sales as a share of target, from 80% to
 * 110% so the part that matters fills the dial. Red below 95%, amber to
 * 100%, green beyond. The range sits underneath in words, because a
 * needle can't show one. */
export function TargetGauge({ state }: { state: AsyncState<Forecast> }) {
  return (
    <AsyncView state={state}>
      {(fc) => {
        if (!fc.available) return <EmptyState message={fc.reason} />;
        const pct = fc.targetFull ? (fc.projected / fc.targetFull) * 100 : 0;
        const low = fc.targetFull ? (fc.projectedLow / fc.targetFull) * 100 : 0;
        const high = fc.targetFull ? (fc.projectedHigh / fc.targetFull) * 100 : 0;
        return (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <EChart
                build={(width) => ({
                  series: [
                    {
                      type: "gauge",
                      min: 80,
                      max: 110,
                      startAngle: 200,
                      endAngle: -20,
                      radius: width < 360 ? "88%" : "96%",
                      center: ["50%", "62%"],
                      splitNumber: 6,
                      axisLine: {
                        lineStyle: {
                          width: 14,
                          color: [
                            [0.5, COLORS.errorBright],
                            [2 / 3, "#F9A825"],
                            [1, COLORS.successBright],
                          ],
                        },
                      },
                      pointer: { length: "62%", width: 5, itemStyle: { color: COLORS.cloud } },
                      anchor: { show: true, size: 12, itemStyle: { color: COLORS.cloud, borderColor: COLORS.deepTerrain, borderWidth: 2 } },
                      axisTick: { distance: -14, length: 5, lineStyle: { color: COLORS.deepTerrain, width: 1 } },
                      splitLine: { distance: -14, length: 14, lineStyle: { color: COLORS.deepTerrain, width: 2 } },
                      axisLabel: { distance: 20, color: COLORS.mist, fontSize: 10, formatter: "{value}%" },
                      title: { show: true, offsetCenter: [0, "34%"], color: COLORS.mist, fontSize: 11 },
                      detail: {
                        valueAnimation: true,
                        offsetCenter: [0, "12%"],
                        fontSize: width < 360 ? 22 : 28,
                        fontWeight: 500,
                        color: COLORS.cloud,
                        formatter: (v: number) => `${v.toFixed(1)}%`,
                      },
                      data: [{ value: Math.max(80, Math.min(110, Number(pct.toFixed(1)))), name: fc.complete ? "of target" : "projected, of target" }],
                    },
                  ],
                })}
              />
            </div>
            <p className="flex-shrink-0 text-center text-xs text-mist">
              {fc.complete ? (
                <>Year complete: {formatGbpShort(fc.projected, 2)} against {formatGbpShort(fc.targetFull, 2)}</>
              ) : (
                <>
                  Range <span className="text-cloud">{low.toFixed(1)}%</span> to <span className="text-cloud">{high.toFixed(1)}%</span> of a{" "}
                  {formatGbpShort(fc.targetFull, 1)} target
                </>
              )}
            </p>
          </div>
        );
      }}
    </AsyncView>
  );
}