"use client";

import { IconPercentage, IconMoneybag, IconTag, IconScale, IconCalculator } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { MarginsSummary } from "@/lib/queries/marginsPage";
import { formatDelta, formatGbpShort, formatShare, pctChange, ppChange } from "@/lib/format";

export function MarginsKpis({ state }: { state: AsyncState<MarginsSummary> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const k = state.data;
  const pp = (a: number, b: number | null) => ppChange(a, b);
  const gm = pp(k.marginTy, k.marginLy);
  const gp = pctChange(k.grossProfitTy, k.grossProfitLy);
  const fp = pp(k.fullPriceMixTy, k.fullPriceMixLy);
  const nc = pp(k.netContributionPctTy, k.netContributionPctLy);
  const cost = pp(k.costRatioTy, k.costRatioLy);
  return (
    <KpiStrip>
      <KpiTile label="Gross margin" value={formatShare(k.marginTy)} icon={IconPercentage}
        delta={gm === null ? null : formatDelta(gm, "pp")} deltaGood={gm === null ? null : gm >= 0} />
      <KpiTile label="Gross profit" value={formatGbpShort(k.grossProfitTy, 2)} icon={IconMoneybag}
        delta={gp === null ? null : formatDelta(gp)} deltaGood={gp === null ? null : gp >= 0} />
      <KpiTile label="Full-price mix" value={formatShare(k.fullPriceMixTy)} icon={IconTag}
        delta={fp === null ? null : formatDelta(fp, "pp")} deltaGood={fp === null ? null : fp >= 0} />
      <KpiTile label="Net contribution" value={formatShare(k.netContributionPctTy)} icon={IconScale}
        delta={nc === null ? null : formatDelta(nc, "pp")} deltaGood={nc === null ? null : nc >= 0} />
      {/* A cost ratio going up is bad news, so the colour is flipped. */}
      <KpiTile label="Store costs / sales" value={formatShare(k.costRatioTy)} icon={IconCalculator}
        delta={cost === null ? null : formatDelta(cost, "pp")} deltaGood={cost === null ? null : cost <= 0} />
    </KpiStrip>
  );
}