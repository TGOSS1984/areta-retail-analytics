"use client";

import { IconShoppingBag, IconReceipt2, IconPackages, IconStack2, IconArrowBackUp } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { BasketSummary } from "@/lib/queries/customersPage";
import { formatCount, formatDelta, formatShare, pctChange, ppChange } from "@/lib/format";

export function CustomersKpis({ state }: { state: AsyncState<BasketSummary> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data;
  const tile = (d: number | null, unit: "%" | "pp" = "%", upIsGood = true) => ({
    delta: d === null ? null : formatDelta(d, unit),
    deltaGood: d === null ? null : upIsGood ? d >= 0 : d <= 0,
  });
  return (
    <KpiStrip>
      <KpiTile label="Baskets" value={formatCount(k.basketsTy, 2)} icon={IconShoppingBag} {...tile(pctChange(k.basketsTy, k.basketsLy))} />
      <KpiTile label="Spend per basket" value={`£${k.atvTy.toFixed(2)}`} icon={IconReceipt2} {...tile(pctChange(k.atvTy, k.atvLy))} />
      <KpiTile label="Items per basket" value={k.itemsPerBasketTy.toFixed(2)} icon={IconPackages}
        {...tile(pctChange(k.itemsPerBasketTy, k.itemsPerBasketLy))} />
      <KpiTile label="Multi-item baskets" value={formatShare(k.multiItemShareTy)} icon={IconStack2}
        {...tile(ppChange(k.multiItemShareTy, k.multiItemShareLy), "pp")} />
      {/* Returns going up is bad news, so the colour is flipped. */}
      <KpiTile label="Return rate" value={formatShare(k.returnRateTy, 2)} icon={IconArrowBackUp}
        {...tile(ppChange(k.returnRateTy, k.returnRateLy), "pp", false)} />
    </KpiStrip>
  );
}