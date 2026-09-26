"use client";

import { IconWalk, IconChartFunnel, IconReceipt2, IconShoppingBag, IconRuler } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StoresSummary } from "@/lib/queries/storesPage";
import { formatCount, formatDelta, formatShare, pctChange, ppChange } from "@/lib/format";

export function StoresKpis({ state }: { state: AsyncState<StoresSummary> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data.kpis;
  const pct = (a: number, b: number | null) => pctChange(a, b);
  const tile = (d: number | null, unit: "%" | "pp" = "%") => ({
    delta: d === null ? null : formatDelta(d, unit),
    deltaGood: d === null ? null : d >= 0,
  });

  return (
    <KpiStrip>
      <KpiTile label="Footfall" value={formatCount(k.footfallTy, 2)} icon={IconWalk} {...tile(pct(k.footfallTy, k.footfallLy))} />
      <KpiTile label="Conversion" value={formatShare(k.conversionTy)} icon={IconChartFunnel}
        {...tile(ppChange(k.conversionTy, k.conversionLy), "pp")} />
      <KpiTile label="Avg transaction" value={`£${k.atvTy.toFixed(2)}`} icon={IconReceipt2} {...tile(pct(k.atvTy, k.atvLy))} />
      <KpiTile label="Items per basket" value={k.iptTy.toFixed(2)} icon={IconShoppingBag} {...tile(pct(k.iptTy, k.iptLy))} />
      <KpiTile label="Sales / sq ft (yr)" value={`£${k.salesPerSqFtTy.toFixed(2)}`} icon={IconRuler}
        {...tile(pct(k.salesPerSqFtTy, k.salesPerSqFtLy))} />
    </KpiStrip>
  );
}