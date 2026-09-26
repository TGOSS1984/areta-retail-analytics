"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { MarginsKpis } from "@/components/margins/MarginsKpis";
import { PnlWaterfall } from "@/components/margins/PnlWaterfall";
import { DiscountBandChart } from "@/components/margins/DiscountBandChart";
import { ContributionBoxPlot } from "@/components/margins/ContributionBoxPlot";
import { MarginMatrix } from "@/components/margins/MarginMatrix";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchMarginsSummary } from "@/lib/queries/marginsPage";

export default function MarginsPage() {
  // The KPI strip and the P&L waterfall read the same summary.
  const summary = useFilteredData(fetchMarginsSummary);

  return (
    <PageFrame>
      <PageHeader>
        <MarginsKpis state={summary} />
      </PageHeader>
      <ChartGrid>
        <ChartCard
          title="Store P&L bridge"
          subtitle="Retail and concession stores · labels are % of turnover"
          className="md:col-span-2 xl:col-span-7"
          mobileHeight="h-[360px]"
        >
          <PnlWaterfall state={summary} />
        </ChartCard>
        <ChartCard title="The cost of discounting" subtitle="Sales and gross margin by discount band" className="md:col-span-2 xl:col-span-5">
          <DiscountBandChart />
        </ChartCard>
        <ChartCard
          title="Store contribution spread"
          subtitle="Net contribution % by store type · dots are outliers"
          className="xl:col-span-5"
          mobileHeight="h-[340px]"
        >
          <ContributionBoxPlot />
        </ChartCard>
        <ChartCard title="Margin matrix" subtitle="Gross margin by product group and period" className="xl:col-span-7" mobileHeight="h-[440px]">
          <MarginMatrix />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}