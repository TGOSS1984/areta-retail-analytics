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
import { FilterBar } from "@/components/filters/FilterBar";
import { useSalesSummary } from "@/lib/hooks/useSalesSummary";
import { useKpiTrends } from "@/lib/hooks/useKpiTrends";
import { formatGbpMillions, formatThousands, formatPct, formatDelta } from "@/lib/format";

export function Hero() {
  const summary = useSalesSummary();
  const trends = useKpiTrends();
  // Sparklines are polish, not load-bearing: if the trends query is still
  // loading or fails, the cards render without one.
  const t = trends.status === "ready" ? trends.data : null;

  const card = (label: string, value: string, delta: number | undefined, unit: "%" | "pp", icon: React.ReactNode, sparkline?: number[]) => ({
    label,
    value,
    deltaLabel: delta === undefined ? null : formatDelta(delta, unit),
    trend: delta === undefined || delta >= 0 ? ("up" as const) : ("down" as const),
    icon,
    sparkline,
  });

  const kpis =
    summary.status === "ready"
      ? (() => {
          const s = summary.data;
          const d = s.deltaVsLastYear;
          return [
            card("Total sales", formatGbpMillions(s.totalSalesGbp), d?.totalSalesPct, "%", <IconCoin size={16} />, t?.totalSales),
            card("Total units", formatThousands(s.totalUnits), d?.totalUnitsPct, "%", <IconShoppingCart size={16} />, t?.totalUnits),
            card("Gross margin", formatPct(s.grossMarginPct), d?.grossMarginPp, "pp", <IconPercentage size={16} />, t?.grossMarginPct),
            card("Retail sales", formatGbpMillions(s.retailSalesGbp), d?.retailSalesPct, "%", <IconBuildingStore size={16} />, t?.retailSales),
            card("Concession sales", formatGbpMillions(s.concessionSalesGbp), d?.concessionSalesPct, "%", <IconTag size={16} />, t?.concessionSales),
            card("Online sales", formatGbpMillions(s.onlineSalesGbp), d?.onlineSalesPct, "%", <IconDeviceDesktop size={16} />, t?.onlineSales),
          ];
        })()
      : [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10">
      <Image src="/images/hero-image-dark.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-terrain via-deep-terrain/75 to-deep-terrain/30" />

      <div className="relative flex flex-col gap-5 p-4 md:gap-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-summit-gold md:text-xs">Data drives higher ground</p>
            <h1 className="mt-2 max-w-md text-xl font-medium leading-snug text-cloud md:text-2xl">
              Insights for a stronger tomorrow
            </h1>
            <div className="mt-3 h-px w-10 bg-summit-gold" />
          </div>
          <FilterBar />
        </div>

        {summary.status === "loading" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-xl bg-charcoal/30" />
            ))}
          </div>
        )}

        {summary.status === "error" && (
          <div className="rounded-xl bg-charcoal/40 p-4 text-sm text-cloud">
            Couldn&apos;t load sales data: {summary.message}
          </div>
        )}

        {summary.status === "ready" && (
          // Two across on phones, three on tablets, one row of six on
          // desktop: always a tidy grid, never a ragged wrap.
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}