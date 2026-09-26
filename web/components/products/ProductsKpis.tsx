"use client";

import { IconCoin, IconPackage, IconTag, IconHanger, IconChartPie } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { ProductsSummary, StyleSales } from "@/lib/queries/productsPage";
import { formatCount, formatDelta, formatGbpShort, formatShare, pctChange } from "@/lib/format";

/** Share of sales from the best-selling fifth of styles: one number for
 * how concentrated the range is. */
export function topFifthShare(styles: StyleSales[]): number {
  const total = styles.reduce((s, x) => s + x.sales, 0);
  const n = Math.max(1, Math.round(styles.length * 0.2));
  return total ? styles.slice(0, n).reduce((s, x) => s + x.sales, 0) / total : 0;
}

export function ProductsKpis({ summary, styles }: { summary: AsyncState<ProductsSummary>; styles: AsyncState<StyleSales[]> }) {
  if (summary.status !== "ready") return <KpiStripSkeleton />;
  const k = summary.data;
  const tile = (d: number | null, unit: "%" | "pp" = "%") => ({
    delta: d === null ? null : formatDelta(d, unit),
    deltaGood: d === null ? null : d >= 0,
  });
  const styleDelta = k.stylesSellingLy === null ? null : k.stylesSelling - k.stylesSellingLy;
  return (
    <KpiStrip>
      <KpiTile label="Net sales" value={formatGbpShort(k.salesTy, 2)} icon={IconCoin} {...tile(pctChange(k.salesTy, k.salesLy))} />
      <KpiTile label="Units" value={formatCount(k.unitsTy)} icon={IconPackage} {...tile(pctChange(k.unitsTy, k.unitsLy))} />
      <KpiTile label="Avg selling price" value={`£${k.aspTy.toFixed(2)}`} icon={IconTag} {...tile(pctChange(k.aspTy, k.aspLy))} />
      <KpiTile
        label="Styles selling"
        value={formatCount(k.stylesSelling)}
        icon={IconHanger}
        delta={styleDelta === null ? null : `${styleDelta >= 0 ? "+" : ""}${styleDelta}`}
        deltaGood={null}
      />
      <KpiTile
        label="Top 20% of styles"
        value={styles.status === "ready" ? formatShare(topFifthShare(styles.data)) : "…"}
        icon={IconChartPie}
        delta="of sales"
        deltaGood={null}
        comparison=""
      />
    </KpiStrip>
  );
}