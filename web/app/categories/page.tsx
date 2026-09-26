"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { CategoriesKpis } from "@/components/categories/CategoriesKpis";
import { MarketGrowthHeatmap } from "@/components/categories/MarketGrowthHeatmap";
import { CategorySunburst } from "@/components/categories/CategorySunburst";
import { ChannelSankey } from "@/components/categories/ChannelSankey";
import { GroupGrowthBars } from "@/components/categories/GroupGrowthBars";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchGroupRows } from "@/lib/queries/categoriesPage";

export default function CategoriesPage() {
  // KPIs, the sunburst and the growth bars share the product group rows.
  const groups = useFilteredData(fetchGroupRows);

  return (
    <PageFrame>
      <PageHeader>
        <CategoriesKpis state={groups} />
      </PageHeader>
      <ChartGrid>
        <ChartCard
          title="Growth by category and market"
          subtitle="Major group x market, vs last year"
          className="md:col-span-2 xl:col-span-7"
          mobileHeight="h-[380px]"
        >
          <MarketGrowthHeatmap />
        </ChartCard>
        <ChartCard title="Range mix" subtitle="Division, major group, product group · click to zoom" className="md:col-span-2 xl:col-span-5" mobileHeight="h-[360px]">
          <CategorySunburst state={groups} />
        </ChartCard>
        <ChartCard title="Channel to category" subtitle="Where each channel's sales go" className="xl:col-span-7" mobileHeight="h-[340px]">
          <ChannelSankey />
        </ChartCard>
        <ChartCard title="Risers and fallers" subtitle="Product groups, vs last year" className="xl:col-span-5" mobileHeight="h-[340px]">
          <GroupGrowthBars state={groups} />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}