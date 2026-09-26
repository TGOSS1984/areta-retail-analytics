"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StoresSummary } from "@/lib/queries/storesPage";
import { COLORS, COMPACT_WIDTH, tooltipBase } from "@/lib/chartTheme";
import { formatCount, formatShare } from "@/lib/format";

const STEP_COLORS = [COLORS.teal, "#6FA5A8", COLORS.gold];

/** Funnel: people through the door, people who bought, people who bought
 * more than one thing. Each step shows its rate from the step before, and
 * the same rate last year underneath, because the rates are the part a
 * store team can move. */
export function StoreFunnel({ state }: { state: AsyncState<StoresSummary> }) {
  return (
    <AsyncView state={state}>
      {({ funnel }) => {
        const rates = funnel.map((s, i) => (i === 0 ? null : funnel[i - 1].ty ? s.ty / funnel[i - 1].ty : 0));
        const lyRates = funnel.map((s, i) =>
          i === 0 || s.ly === null || !funnel[i - 1].ly ? null : s.ly / (funnel[i - 1].ly as number),
        );
        return (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <EChart
                build={(width) => {
                  const compact = width < COMPACT_WIDTH;
                  return {
                    tooltip: {
                      ...tooltipBase,
                      formatter: (p: { dataIndex: number }) => {
                        const s = funnel[p.dataIndex];
                        const r = rates[p.dataIndex];
                        return `${s.label}<br/>${formatCount(s.ty, 2)}${r === null ? "" : ` · ${formatShare(r)} of the step before`}`;
                      },
                    },
                    series: [
                      {
                        type: "funnel",
                        left: compact ? "4%" : "10%",
                        right: compact ? "4%" : "10%",
                        top: 4,
                        bottom: 4,
                        sort: "none",
                        gap: 4,
                        // Real proportions would make the last two steps
                        // slivers (only about 1 visitor in 6 buys), so the
                        // widths are fixed and the numbers carry the scale.
                        min: 0,
                        max: 100,
                        minSize: "38%",
                        label: {
                          position: "inside",
                          color: COLORS.cloud,
                          fontSize: compact ? 11 : 12,
                          formatter: (p: { dataIndex: number }) => {
                            const s = funnel[p.dataIndex];
                            const r = rates[p.dataIndex];
                            return `${s.label}\n${formatCount(s.ty, 2)}${r === null ? "" : `  ·  ${formatShare(r)}`}`;
                          },
                        },
                        itemStyle: { borderColor: COLORS.deepTerrain, borderWidth: 1 },
                        data: funnel.map((s, i) => ({ name: s.label, value: 100 - i * 25, itemStyle: { color: STEP_COLORS[i] } })),
                      },
                    ],
                  };
                }}
              />
            </div>
            <div className="mt-2 grid flex-shrink-0 grid-cols-2 gap-2 text-center text-[11px] text-mist">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg bg-white/5 px-2 py-1.5">
                  <span className="text-cloud">{funnel[i].label}</span>: {formatShare(rates[i] ?? 0)}
                  {lyRates[i] !== null && <> (LY {formatShare(lyRates[i] as number)})</>}
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </AsyncView>
  );
}