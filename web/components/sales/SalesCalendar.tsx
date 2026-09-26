"use client";

import { EChart } from "@/components/charts/base/EChart";
import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchDailySales } from "@/lib/queries/salesPage";
import { COLORS, HEAT_SCALE, tooltipBase } from "@/lib/chartTheme";
import { formatGbpShort } from "@/lib/format";
import { formatShortDate, daysBetweenInclusive } from "@/lib/filters/dates";

/** Calendar heatmap: every trading day as a cell, weeks across and days
 * down (Sunday first, matching the retail week). Saturdays, the autumn
 * range landing, Black Friday and the shut Christmas Day all show up
 * without anyone having to go looking for them. Needs roughly 14px per
 * week to stay readable, so on a phone a long selection scrolls sideways
 * instead of shrinking to specks. */
export function SalesCalendar() {
  const state = useFilteredData(fetchDailySales);
  return (
    <AsyncView state={state}>
      {(days) => {
        if (days.length === 0) return null;
        const start = days[0].date;
        const end = days[days.length - 1].date;
        const weeks = Math.ceil(daysBetweenInclusive(start, end) / 7) + 1;
        const values = days.map((d) => d.ty);
        const sorted = [...values].sort((a, b) => a - b);
        // Colour range from the 2nd to 98th percentile, so one huge day
        // (Black Friday) doesn't wash every other day out to one colour.
        const lo = sorted[Math.floor(sorted.length * 0.02)] ?? 0;
        const hi = sorted[Math.floor(sorted.length * 0.98)] ?? 1;
        const byDate = new Map(days.map((d) => [d.date, d]));

        return (
          <EChart
            minWidth={weeks * 14 + 70}
            build={() => ({
              tooltip: {
                ...tooltipBase,
                formatter: (p: { value: [string, number] }) => {
                  const d = byDate.get(p.value[0]);
                  if (!d) return "";
                  const diff = d.ly ? ` (${d.ty >= d.ly ? "+" : ""}${((d.ty / d.ly - 1) * 100).toFixed(0)}% vs LY)` : "";
                  return `${formatShortDate(d.date)}<br/>${formatGbpShort(d.ty, 1)}${diff}`;
                },
              },
              visualMap: {
                min: lo,
                max: hi,
                calculable: false,
                orient: "horizontal",
                left: "center",
                bottom: 0,
                itemHeight: 120,
                itemWidth: 8,
                text: [formatGbpShort(hi, 0), formatGbpShort(lo, 0)],
                textStyle: { color: COLORS.mist, fontSize: 10 },
                inRange: { color: HEAT_SCALE },
              },
              calendar: {
                range: [start, end],
                top: 26,
                left: 36,
                right: 8,
                bottom: 36,
                cellSize: ["auto", "auto"],
                dayLabel: { firstDay: 0, nameMap: ["S", "M", "T", "W", "T", "F", "S"], color: COLORS.mist, fontSize: 10 },
                monthLabel: { color: COLORS.mist, fontSize: 10 },
                yearLabel: { show: false },
                splitLine: { show: false },
                itemStyle: { color: "rgba(255,255,255,0.03)", borderColor: COLORS.deepTerrain, borderWidth: 2 },
              },
              series: [{ type: "heatmap", coordinateSystem: "calendar", data: days.map((d) => [d.date, d.ty]) }],
            })}
          />
        );
      }}
    </AsyncView>
  );
}