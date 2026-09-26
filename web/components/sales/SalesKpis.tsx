"use client";

import { IconCoin, IconTargetArrow, IconPercentage, IconPackage, IconShoppingCart } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { SalesPageData } from "@/lib/queries/salesPage";
import { formatCount, formatDelta, formatGbpShort, formatShare, pctChange, ppChange } from "@/lib/format";

export function SalesKpis({ state }: { state: AsyncState<SalesPageData> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data.kpis;
  const sales = pctChange(k.salesTy, k.salesLy);
  const units = pctChange(k.unitsTy, k.unitsLy);
  const margin = ppChange(k.marginTy, k.marginLy);
  const online = ppChange(k.onlineShareTy, k.onlineShareLy);
  const achievement = k.targetToDate ? k.salesTy / k.targetToDate : 0;
  const vsTarget = k.salesTy - k.targetToDate;

  return (
    <KpiStrip>
      <KpiTile label="Net sales" value={formatGbpShort(k.salesTy, 2)} icon={IconCoin}
        delta={sales === null ? null : formatDelta(sales)} deltaGood={sales === null ? null : sales >= 0} />
      <KpiTile label="vs target" value={formatShare(achievement)} icon={IconTargetArrow}
        delta={formatGbpShort(vsTarget)} deltaGood={vsTarget >= 0} comparison="to date" />
      <KpiTile label="Gross margin" value={formatShare(k.marginTy)} icon={IconPercentage}
        delta={margin === null ? null : formatDelta(margin, "pp")} deltaGood={margin === null ? null : margin >= 0} />
      <KpiTile label="Units" value={formatCount(k.unitsTy)} icon={IconPackage}
        delta={units === null ? null : formatDelta(units)} deltaGood={units === null ? null : units >= 0} />
      <KpiTile label="Online share" value={formatShare(k.onlineShareTy)} icon={IconShoppingCart}
        delta={online === null ? null : formatDelta(online, "pp")} deltaGood={null} />
    </KpiStrip>
  );
}