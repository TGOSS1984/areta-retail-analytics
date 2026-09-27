"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchDeviceConversion } from "@/lib/queries/digitalPage";
import { COLORS, COMPACT_WIDTH, axisLabel, axisLine, splitLine, tooltipBase } from "@/lib/chartTheme";
import { formatCount, formatGbpShort } from "@/lib/format";

/** Bar and line: sessions per device as bars, conversion as a line on
 * its own axis, with last year's conversion as hollow markers. The usual
 * story shows straight away: mobile brings most of the visits, desktop
 * converts them far better. */
export function DeviceConversionChart() {
  const state = useFilteredData(fetchDeviceConversion);
  return (
    <AsyncView state={state}>
      {(rows) => (
        <EChart
          build={(width) => {
            const compact = width < COMPACT_WIDTH;
            const conv = rows.map((r) => r.conversion * 100);
            const convLy = rows.map((r) => (r.conversionLy === null ? null : r.conversionLy * 100));
            const hi = Math.max(...conv, ...convLy.filter((v): v is number => v !== null));
            return {
              grid: { left: compact ? 40 : 52, right: compact ? 40 : 48, top: 32, bottom: 28 },
              legend: { top: 0, right: 0, textStyle: { color: COLORS.mist, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
              tooltip: {
                ...tooltipBase,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: (params: Array<{ dataIndex: number }>) => {
                  const r = rows[params[0]?.dataIndex ?? 0];
                  return `${r.device}<br/>${formatCount(r.sessions)} sessions · ${formatCount(r.orders)} orders<br/>Conversion ${(r.conversion * 100).toFixed(2)}%${
                    r.conversionLy === null ? "" : ` (LY ${(r.conversionLy * 100).toFixed(2)}%)`
                  }<br/>Sales ${formatGbpShort(r.sales, 2)}`;
                },
              },
              xAxis: { type: "category", data: rows.map((r) => r.device), axisLine, axisLabel },
              yAxis: [
                { type: "value", axisLabel: { ...axisLabel, formatter: (v: number) => formatCount(v) }, splitLine },
                { type: "value", min: 0, max: Math.ceil(hi + 0.5), axisLabel: { ...axisLabel, formatter: "{value}%" }, splitLine: { show: false } },
              ],
              series: [
                { name: "Sessions", type: "bar", data: rows.map((r) => r.sessions), barMaxWidth: 48, itemStyle: { color: COLORS.teal, borderRadius: [3, 3, 0, 0] } },
                {
                  name: "Conversion",
                  type: "line",
                  yAxisIndex: 1,
                  data: conv,
                  symbolSize: 10,
                  lineStyle: { color: COLORS.gold, width: 2 },
                  itemStyle: { color: COLORS.gold },
                  label: { show: true, position: "top", color: COLORS.cloud, fontSize: 11, formatter: (p: { value: number }) => `${p.value.toFixed(2)}%` },
                },
                {
                  name: "Conversion LY",
                  type: "scatter",
                  yAxisIndex: 1,
                  data: convLy,
                  symbol: "circle",
                  symbolSize: 10,
                  itemStyle: { color: "transparent", borderColor: COLORS.mist, borderWidth: 2 },
                },
              ],
            };
          }}
        />
      )}
    </AsyncView>
  );
}