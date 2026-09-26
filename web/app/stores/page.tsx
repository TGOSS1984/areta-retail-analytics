"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { StoresKpis } from "@/components/stores/StoresKpis";
import { StoreFunnel } from "@/components/stores/StoreFunnel";
import { FootfallConversionScatter } from "@/components/stores/FootfallConversionScatter";
import { StoreLeagueTable } from "@/components/stores/StoreLeagueTable";
import { FootfallRhythmHeatmap } from "@/components/stores/FootfallRhythmHeatmap";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchStoresSummary, fetchStoreRows } from "@/lib/queries/storesPage";

export default function StoresPage() {
  const summary = useFilteredData(fetchStoresSummary);
  // The scatter and the league table read the same per-store rows.
  const rows = useFilteredData(fetchStoreRows);

  return (
    <PageFrame>
      <PageHeader>
        <StoresKpis state={summary} />
      </PageHeader>
      <ChartGrid>
        <ChartCard title="Store funnel" subtitle="Retail and concession stores" className="xl:col-span-3" mobileHeight="h-[320px]">
          <StoreFunnel state={summary} />
        </ChartCard>
        <ChartCard
          title="Footfall vs conversion"
          subtitle="Each dot a store, sized by sales · dashed lines are the averages"
          className="xl:col-span-4"
          mobileHeight="h-[340px]"
        >
          <FootfallConversionScatter state={rows} />
        </ChartCard>
        <ChartCard
          title="Store league table"
          subtitle="Click a column to sort"
          className="md:col-span-2 xl:col-span-5 xl:row-span-2"
          mobileHeight="h-[460px]"
        >
          <StoreLeagueTable state={rows} />
        </ChartCard>
        <ChartCard
          title="Weekly rhythm"
          subtitle="Average visitors a day, by weekday and period"
          className="md:col-span-2 xl:col-span-7"
          mobileHeight="h-[300px]"
        >
          <FootfallRhythmHeatmap />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}