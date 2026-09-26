"use client";

import { IconTrophy, IconCoin, IconTrendingUp, IconPercentage, IconTag } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { GroupRow } from "@/lib/queries/categoriesPage";
import { formatDelta, formatGbpShort, formatShare, pctChange, ppChange } from "@/lib/format";
import { groupTotals } from "@/components/categories/groupTotals";

export function CategoriesKpis({ state }: { state: AsyncState<GroupRow[]> }) {
  if (state.status !== "ready") return <KpiStripSkeleton />;
  const rows = state.data;
  const sum = (pick: (r: GroupRow) => number | null) => rows.reduce((a, r) => a + (pick(r) ?? 0), 0);
  const hasLy = rows.some((r) => r.salesLy !== null);
  const salesTy = sum((r) => r.salesTy);
  const salesLy = hasLy ? sum((r) => r.salesLy) : null;
  const marginTy = salesTy ? 1 - sum((r) => r.costTy) / salesTy : 0;
  const marginLy = hasLy && salesLy ? 1 - sum((r) => r.costLy) / salesLy : null;
  const unitsTy = sum((r) => r.unitsTy);
  const unitsLy = hasLy ? sum((r) => r.unitsLy) : null;
  const aspTy = unitsTy ? salesTy / unitsTy : 0;
  const aspLy = unitsLy && salesLy ? salesLy / unitsLy : null;

  const totals = groupTotals(rows);
  const top = totals[0];
  const growing = totals.filter((g) => g.salesLy && g.salesTy > g.salesLy).length;
  const sales = pctChange(salesTy, salesLy);
  const margin = ppChange(marginTy, marginLy);
  const asp = pctChange(aspTy, aspLy);

  return (
    <KpiStrip>
      <KpiTile
        label="Top category"
        value={top?.productGroup ?? "–"}
        icon={IconTrophy}
        delta={top && salesTy ? formatShare(top.salesTy / salesTy) : null}
        deltaGood={null}
        comparison="of sales"
      />
      <KpiTile label="Net sales" value={formatGbpShort(salesTy, 2)} icon={IconCoin}
        delta={sales === null ? null : formatDelta(sales)} deltaGood={sales === null ? null : sales >= 0} />
      <KpiTile
        label="Groups growing"
        value={hasLy ? `${growing} of ${totals.length}` : "–"}
        icon={IconTrendingUp}
        delta={hasLy ? formatShare(growing / totals.length, 0) : null}
        deltaGood={hasLy ? growing >= totals.length / 2 : null}
        comparison="up on LY"
      />
      <KpiTile label="Gross margin" value={formatShare(marginTy)} icon={IconPercentage}
        delta={margin === null ? null : formatDelta(margin, "pp")} deltaGood={margin === null ? null : margin >= 0} />
      <KpiTile label="Avg selling price" value={`£${aspTy.toFixed(2)}`} icon={IconTag}
        delta={asp === null ? null : formatDelta(asp)} deltaGood={asp === null ? null : asp >= 0} />
    </KpiStrip>
  );
}