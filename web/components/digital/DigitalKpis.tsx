"use client";

import { IconShoppingCart, IconTargetArrow, IconClick, IconChartFunnel, IconBasket } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DigitalSummary } from "@/lib/queries/digitalPage";
import { formatCount, formatDelta, formatGbpShort, formatShare, pctChange, ppChange } from "@/lib/format";

export function DigitalKpis({ state }: { state: AsyncState<DigitalSummary> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data;
  const tile = (d: number | null, unit: "%" | "pp" = "%") => ({
    delta: d === null ? null : formatDelta(d, unit),
    deltaGood: d === null ? null : d >= 0,
  });
  const vsTarget = k.salesTy - k.targetToDate;
  return (
    <KpiStrip>
      <KpiTile label="Digital sales" value={formatGbpShort(k.salesTy, 2)} icon={IconShoppingCart} {...tile(pctChange(k.salesTy, k.salesLy))} />
      <KpiTile label="vs target" value={k.targetToDate ? formatShare(k.salesTy / k.targetToDate) : "–"} icon={IconTargetArrow}
        delta={formatGbpShort(vsTarget)} deltaGood={vsTarget >= 0} comparison="to date" />
      <KpiTile label="Sessions" value={formatCount(k.sessionsTy, 2)} icon={IconClick} {...tile(pctChange(k.sessionsTy, k.sessionsLy))} />
      <KpiTile label="Conversion" value={formatShare(k.conversionTy, 2)} icon={IconChartFunnel}
        {...tile(ppChange(k.conversionTy, k.conversionLy), "pp")} />
      <KpiTile label="Avg order value" value={`£${k.aovTy.toFixed(2)}`} icon={IconBasket} {...tile(pctChange(k.aovTy, k.aovLy))} />
    </KpiStrip>
  );
}