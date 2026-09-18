"use client";

import Image from "next/image";
import {
  IconCoin,
  IconShoppingCart,
  IconPercentage,
  IconBuildingStore,
  IconTag,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import { KPICard } from "@/components/ui/KPICard";
import { useSalesSummary } from "@/lib/hooks/useSalesSummary";
import { useKpiTrends } from "@/lib/hooks/useKpiTrends";
import { formatGbpMillions, formatThousands, formatPct, formatDelta } from "@/lib/format";

export function Hero() {
  const summary = useSalesSummary();
  const trends = useKpiTrends();
  // Sparklines are optional polish, not load-bearing — if the trends
  // query is still loading or fails, cards render fine with no
  // sparkline rather than blocking on a second data source.
  const t = trends.status === "ready" ? trends.data : null;

  const kpis =
    summary.status === "ready"
      ? [
          {
            label: "Total sales",
            value: formatGbpMillions(summary.data.totalSalesGbp),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.totalSalesPct),
            trend: summary.data.deltaVsLastYear.totalSalesPct >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconCoin size={16} />,
            sparkline: t?.totalSales,
          },
          {
            label: "Total units",
            value: formatThousands(summary.data.totalUnits),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.totalUnitsPct),
            trend: summary.data.deltaVsLastYear.totalUnitsPct >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconShoppingCart size={16} />,
            sparkline: t?.totalUnits,
          },
          {
            label: "Gross margin",
            value: formatPct(summary.data.grossMarginPct),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.grossMarginPp, "pp"),
            trend: summary.data.deltaVsLastYear.grossMarginPp >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconPercentage size={16} />,
            sparkline: t?.grossMarginPct,
          },
          {
            label: "Retail sales",
            value: formatGbpMillions(summary.data.retailSalesGbp),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.retailSalesPct),
            trend: summary.data.deltaVsLastYear.retailSalesPct >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconBuildingStore size={16} />,
            sparkline: t?.retailSales,
          },
          {
            label: "Concession sales",
            value: formatGbpMillions(summary.data.concessionSalesGbp),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.concessionSalesPct),
            trend: summary.data.deltaVsLastYear.concessionSalesPct >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconTag size={16} />,
            sparkline: t?.concessionSales,
          },
          {
            label: "Online sales",
            value: formatGbpMillions(summary.data.onlineSalesGbp),
            deltaLabel: formatDelta(summary.data.deltaVsLastYear.onlineSalesPct),
            trend: summary.data.deltaVsLastYear.onlineSalesPct >= 0 ? ("up" as const) : ("down" as const),
            icon: <IconDeviceDesktop size={16} />,
            sparkline: t?.onlineSales,
          },
        ]
      : [];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <Image src="/images/hero-image-dark.webp" alt="" fill priority className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-terrain via-deep-terrain/70 to-deep-terrain/20" />

      <div className="relative flex flex-col justify-between p-8" style={{ minHeight: 280 }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-summit-gold">
              Data drives higher ground
            </p>
            <h1 className="mt-2 max-w-md text-2xl font-medium leading-snug text-cloud">
              Insights for a stronger tomorrow
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-cloud">
            {summary.status === "ready" && (
              <span className="rounded-full border border-white/20 px-3 py-1.5">
                Periods 1-{summary.data.maxPeriod}, BY{summary.data.currentYear}
              </span>
            )}
            <span className="rounded-full border border-white/20 px-3 py-1.5">All markets</span>
          </div>
        </div>

        {summary.status === "loading" && (
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[84px] flex-1 animate-pulse rounded-xl bg-charcoal/30" />
            ))}
          </div>
        )}

        {summary.status === "error" && (
          <div className="rounded-xl bg-charcoal/40 p-4 text-sm text-cloud">
            Couldn&apos;t load sales data: {summary.message}
          </div>
        )}

        {summary.status === "ready" && (
          <div className="flex flex-wrap gap-3">
            {kpis.map((kpi) => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}