"use client";

import { IconCoin, IconTrendingUp, IconTargetArrow, IconCalendarWeek, IconArrowsDiff } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import { EmptyState } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { Forecast } from "@/lib/queries/forecastPage";
import { formatDelta, formatGbpShort, formatShare } from "@/lib/format";

export function ForecastKpis({ state }: { state: AsyncState<Forecast> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data;
  if (!k.available) return <EmptyState message={k.reason} />;
  const toDate = k.targetToDate ? k.actualToDate / k.targetToDate : 0;
  const achievement = k.targetFull ? k.projected / k.targetFull : 0;
  const gap = k.neededPerWeek - k.projectedPerWeek;
  return (
    <KpiStrip>
      <KpiTile label="Sales to date" value={formatGbpShort(k.actualToDate, 2)} icon={IconCoin}
        delta={formatShare(toDate)} deltaGood={toDate >= 1} comparison="of target to date" />
      <KpiTile label="Growth so far" value={formatDelta((k.growth - 1) * 100)} icon={IconArrowsDiff}
        delta={`${formatDelta((k.growthLow - 1) * 100)} to ${formatDelta((k.growthHigh - 1) * 100)}`} deltaGood={null} comparison="week range" />
      <KpiTile
        label={k.complete ? "Full year" : "Projected full year"}
        value={formatGbpShort(k.projected, 2)}
        icon={IconTrendingUp}
        delta={k.complete ? null : `${formatGbpShort(k.projectedLow, 1)}–${formatGbpShort(k.projectedHigh, 1)}`}
        deltaGood={null}
        comparison="range"
      />
      <KpiTile label={k.complete ? "vs target" : "Projected vs target"} value={formatShare(achievement)} icon={IconTargetArrow}
        delta={formatGbpShort(k.projected - k.targetFull)} deltaGood={achievement >= 1} comparison={`of ${formatGbpShort(k.targetFull, 1)}`} />
      <KpiTile
        label="Needed per week"
        value={k.complete ? "Year complete" : formatGbpShort(k.neededPerWeek, 0)}
        icon={IconCalendarWeek}
        delta={k.complete ? null : `${gap > 0 ? "+" : ""}${formatGbpShort(gap, 0)}`}
        deltaGood={k.complete ? null : gap <= 0}
        comparison="vs projected pace"
      />
    </KpiStrip>
  );
}