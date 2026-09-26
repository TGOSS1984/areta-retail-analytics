"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { MarginsSummary } from "@/lib/queries/marginsPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";

type Step = { label: string; value: number; kind: "total" | "cost" };

/** P&L waterfall for the stores: turnover, less cost of goods, down to
 * gross profit, then each running cost down to net contribution. Totals
 * are teal bars from zero; costs hang red from the running total. Same
 * stacked-bar build as the Sales page bridge, and it turns horizontal on
 * a narrow screen the same way. */
export function PnlWaterfall({ state }: { state: AsyncState<MarginsSummary> }) {
  return (
    <AsyncView state={state}>
      {({ pnl }) => {
        const steps: Step[] = [
          { label: "Turnover", value: pnl.turnover, kind: "total" },
          { label: "Cost of goods", value: pnl.cogs, kind: "cost" },
          { label: "Gross profit", value: pnl.grossProfit, kind: "total" },
          { label: "Rent", value: pnl.rent, kind: "cost" },
          { label: "Staff", value: pnl.staff, kind: "cost" },
          { label: "Utilities", value: pnl.utilities, kind: "cost" },
          { label: "Marketing", value: pnl.marketing, kind: "cost" },
          { label: "Head office", value: pnl.headOffice, kind: "cost" },
          { label: "Net contribution", value: pnl.netContribution, kind: "total" },
        ];
        const base: number[] = [];
        let running = 0;
        for (const s of steps) {
          if (s.kind === "total") {
            running = s.value;
            base.push(0);
          } else {
            running -= s.value;
            base.push(running);
          }
        }
        return (
          <EChart
            build={(width) => {
              const horizontal = width < COMPACT_WIDTH;
              const categoryAxis = {
                type: "category",
                data: steps.map((s) => s.label),
                axisLine,
                inverse: horizontal,
                axisLabel: { ...axisLabel, interval: 0, rotate: horizontal ? 0 : 30, fontSize: 10 },
              };
              const valueAxis = { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatGbpShort(v, 0) }, splitLine };
              return {
                grid: horizontal ? { left: 100, right: 52, top: 8, bottom: 24 } : { left: 56, right: 12, top: 24, bottom: 60 },
                tooltip: {
                  ...tooltipBase,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                  formatter: (params: Array<{ dataIndex: number }>) => {
                    const s = steps[params[0]?.dataIndex ?? 0];
                    const share = pnl.turnover ? ((s.value / pnl.turnover) * 100).toFixed(1) : "–";
                    return `${s.label}<br/>${s.kind === "cost" ? "−" : ""}${formatGbpShort(s.value, 2)} · ${share}% of turnover`;
                  },
                },
                xAxis: horizontal ? valueAxis : categoryAxis,
                yAxis: horizontal ? categoryAxis : valueAxis,
                series: [
                  { type: "bar", stack: "p", data: base, itemStyle: { color: "transparent" }, silent: true, emphasis: { disabled: true } },
                  {
                    type: "bar",
                    stack: "p",
                    barMaxWidth: 38,
                    data: steps.map((s) => ({
                      value: s.value,
                      itemStyle: {
                        color: s.kind === "total" ? (s.label === "Net contribution" ? COLORS.gold : COLORS.teal) : COLORS.errorBright,
                        borderRadius: 2,
                      },
                    })),
                    label: {
                      show: !horizontal || width > 360,
                      position: horizontal ? "right" : "top",
                      color: COLORS.mist,
                      fontSize: 10,
                      formatter: (p: { dataIndex: number }) => {
                        const s = steps[p.dataIndex];
                        return pnl.turnover ? `${((s.value / pnl.turnover) * 100).toFixed(0)}%` : "";
                      },
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