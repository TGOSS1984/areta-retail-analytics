"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { SalesKpis } from "@/components/sales/SalesKpis";
import { WeeklyTrendChart } from "@/components/sales/WeeklyTrendChart";
import { SalesCalendar } from "@/components/sales/SalesCalendar";
import { SalesBridgeChart } from "@/components/sales/SalesBridgeChart";
import { PeriodTargetChart } from "@/components/sales/PeriodTargetChart";
import { useFilteredData, useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { fetchSalesPage } from "@/lib/queries/salesPage";

export default function SalesPage() {
  // One query feeds both the KPI strip and the target chart, since both
  // need the phased period targets.
  const page = useFilteredData(fetchSalesPage);
  const filters = useResolvedFilters();

  return (
    <PageFrame>
      <PageHeader />
      <SalesKpis state={page} />
      <ChartGrid>
        <ChartCard
          title="Weekly sales"
          subtitle="This year against the same weeks last year"
          className="md:col-span-2 xl:col-span-7"
        >
          <WeeklyTrendChart />
        </ChartCard>
        <ChartCard
          title={filters?.market ? "What moved: by channel" : "What moved: by market"}
          subtitle="Last year to this year, step by step"
          className="md:col-span-2 xl:col-span-5"
          mobileHeight="h-[360px]"
        >
          <SalesBridgeChart />
        </ChartCard>
        <ChartCard
          title="Trading calendar"
          subtitle="Every day's sales · hover for last year"
          className="md:col-span-2 xl:col-span-7"
          mobileHeight="h-[240px]"
        >
          <SalesCalendar />
        </ChartCard>
        <ChartCard
          title="Sales vs target"
          subtitle="By period · * still trading, target phased to date"
          className="md:col-span-2 xl:col-span-5"
        >
          <PeriodTargetChart state={page} />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}