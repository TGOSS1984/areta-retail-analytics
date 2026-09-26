"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { MarketNotice } from "@/components/ui/MarketNotice";
import { ProductsKpis } from "@/components/products/ProductsKpis";
import { StyleParetoChart } from "@/components/products/StyleParetoChart";
import { BrandTreemap } from "@/components/products/BrandTreemap";
import { PriceVolumeScatter } from "@/components/products/PriceVolumeScatter";
import { ProductRankingTable } from "@/components/products/ProductRankingTable";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchProductsSummary, fetchStyleSales } from "@/lib/queries/productsPage";

export default function ProductsPage() {
  const summary = useFilteredData(fetchProductsSummary);
  // The Pareto, the scatter, the treemap and one KPI all read the same
  // style totals, so they're fetched once here.
  const styles = useFilteredData(fetchStyleSales);

  return (
    <PageFrame>
      <PageHeader>
        <MarketNotice reason="product sales are exported by style and colour, not by store." />
        <ProductsKpis summary={summary} styles={styles} />
      </PageHeader>
      <ChartGrid>
        <ChartCard
          title="Style Pareto"
          subtitle="Every style, best to worst, with the running share of sales"
          className="md:col-span-2 xl:col-span-7"
        >
          <StyleParetoChart state={styles} />
        </ChartCard>
        <ChartCard title="Brand and category" subtitle="Area by sales · click a brand to zoom in" className="md:col-span-2 xl:col-span-5">
          <BrandTreemap state={styles} />
        </ChartCard>
        <ChartCard
          title="Price vs volume"
          subtitle="Each bubble a style, sized by sales · units on a log scale"
          className="xl:col-span-5"
          mobileHeight="h-[340px]"
        >
          <PriceVolumeScatter state={styles} />
        </ChartCard>
        <ChartCard title="Best and slowest sellers" subtitle="Style-colours, with their weekly trend" className="xl:col-span-7" mobileHeight="h-[520px]">
          <ProductRankingTable />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}