"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StoreRow } from "@/lib/queries/storesPage";
import { COLORS, COMPACT_WIDTH, PALETTE, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount, formatGbpShort, formatShare } from "@/lib/format";

/** Scatter: every store's footfall against its conversion, sized by
 * sales and coloured by store type, with average lines splitting it into
 * quadrants. Top right is busy and converting; bottom right is busy but
 * leaking shoppers, which is where a store visit pays off most. */
export function FootfallConversionScatter({ state }: { state: AsyncState<StoreRow[]> }) {
  return (
    <AsyncView state={state}>
      {(rows) => {
        const types = Array.from(new Set(rows.map((r) => r.storeType))).sort();
        const maxSales = Math.max(...rows.map((r) => r.salesTy), 1);
        const avgFootfall = rows.reduce((s, r) => s + r.footfall, 0) / Math.max(rows.length, 1);
        const totalFootfall = rows.reduce((s, r) => s + r.footfall, 0);
        const avgConversion = totalFootfall
          ? rows.reduce((s, r) => s + r.conversion * r.footfall, 0) / totalFootfall
          : 0;
        return (
          <EChart
            build={(width) => {
              const compact = width < COMPACT_WIDTH;
              return {
                grid: { left: compact ? 44 : 52, right: 16, top: compact ? 44 : 32, bottom: 36 },
                legend: {
                  top: 0,
                  left: compact ? 0 : undefined,
                  right: compact ? undefined : 0,
                  textStyle: { color: COLORS.mist, fontSize: 11 },
                  itemWidth: 10,
                  itemHeight: 10,
                },
                tooltip: {
                  ...tooltipBase,
                  formatter: (p: { data: { store: StoreRow } }) => {
                    const r = p.data.store;
                    return `${r.storeName}<br/>${r.market} · ${r.storeType}<br/>Footfall ${formatCount(r.footfall)} · Conversion ${formatShare(r.conversion)}<br/>Sales ${formatGbpShort(r.salesTy, 1)}`;
                  },
                },
                xAxis: {
                  type: "value",
                  name: "Footfall",
                  nameLocation: "middle",
                  nameGap: 24,
                  nameTextStyle: { color: COLORS.mist, fontSize: 10 },
                  axisLabel: { ...axisLabel, formatter: (v: number) => formatCount(v) },
                  axisLine,
                  splitLine,
                },
                yAxis: {
                  type: "value",
                  scale: true,
                  axisLabel: { ...axisLabel, formatter: (v: number) => formatShare(v, 0) },
                  splitLine,
                },
                series: types.map((type, i) => ({
                  name: type,
                  type: "scatter",
                  data: rows
                    .filter((r) => r.storeType === type)
                    .map((r) => ({ value: [r.footfall, r.conversion], store: r })),
                  symbolSize: (_: unknown, p: { data: { store: StoreRow } }) =>
                    6 + Math.sqrt(p.data.store.salesTy / maxSales) * (compact ? 16 : 24),
                  itemStyle: { color: PALETTE[i % PALETTE.length], opacity: 0.75, borderColor: COLORS.deepTerrain },
                  ...(i === 0
                    ? {
                        markLine: {
                          silent: true,
                          symbol: "none",
                          lineStyle: { color: "rgba(255,255,255,0.3)", type: "dashed" },
                          label: { show: false },
                          data: [{ xAxis: avgFootfall }, { yAxis: avgConversion }],
                        },
                      }
                    : {}),
                })),
              };
            }}
          />
        );
      }}
    </AsyncView>
  );
}