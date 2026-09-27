"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { CustomersKpis } from "@/components/customers/CustomersKpis";
import { BasketSizeHistogram } from "@/components/customers/BasketSizeHistogram";
import { SpendDotPlot } from "@/components/customers/SpendDotPlot";
import { MultiItemTrend } from "@/components/customers/MultiItemTrend";
import { ReturnsRadialBars } from "@/components/customers/ReturnsRadialBars";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchBasketSummary } from "@/lib/queries/customersPage";

export default function CustomersPage() {
  const summary = useFilteredData(fetchBasketSummary);
  return (
    <PageFrame>
      <PageHeader>
        <CustomersKpis state={summary} />
      </PageHeader>
      <ChartGrid>
        <ChartCard title="Basket sizes" subtitle="Share of baskets and of sales, by items per basket" className="md:col-span-2 xl:col-span-6">
          <BasketSizeHistogram />
        </ChartCard>
        <ChartCard title="Spend per basket" subtitle="By market, one dot per channel" className="md:col-span-2 xl:col-span-6" mobileHeight="h-[400px]">
          <SpendDotPlot />
        </ChartCard>
        <ChartCard title="Multi-item baskets" subtitle="Share of baskets with 2+ items, by week" className="xl:col-span-7">
          <MultiItemTrend />
        </ChartCard>
        <ChartCard title="Returns by category" subtitle="Share of gross sales refunded" className="xl:col-span-5" mobileHeight="h-[340px]">
          <ReturnsRadialBars />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}