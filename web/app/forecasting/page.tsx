"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { ForecastKpis } from "@/components/forecasting/ForecastKpis";
import { ForecastChart } from "@/components/forecasting/ForecastChart";
import { TargetGauge } from "@/components/forecasting/TargetGauge";
import { ProjectionTable } from "@/components/forecasting/ProjectionTable";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { useFilters } from "@/lib/hooks/useFilters";
import { fetchForecast } from "@/lib/queries/forecastPage";

export default function ForecastingPage() {
  const forecast = useFilteredData(fetchForecast);
  const { raw } = useFilters();
  // A projection is about the whole year, so the period range doesn't
  // apply here. Only say so when someone has actually picked one.
  const rangePicked = raw.from !== undefined || raw.to !== undefined;

  return (
    <PageFrame>
      <PageHeader>
        <p className="flex items-start gap-2 rounded-lg bg-charcoal/40 px-3 py-2 text-xs text-cloud backdrop-blur-sm">
          <IconInfoCircle size={14} className="mt-0.5 flex-shrink-0 text-summit-gold" aria-hidden="true" />
          <span>
            How it works: every day still to come is last year&apos;s same day, times this year&apos;s growth so far. The range
            uses this year&apos;s slowest and fastest weeks instead (10th and 90th percentile).
            {rangePicked && " The period range doesn't apply here: a projection always covers the whole business year."}
          </span>
        </p>
        <ForecastKpis state={forecast} />
      </PageHeader>
      <ChartGrid>
        <ChartCard title="The year so far, and where it's heading" subtitle="Cumulative sales vs target" className="md:col-span-2 xl:col-span-8" mobileHeight="h-[340px]">
          <ForecastChart state={forecast} />
        </ChartCard>
        <ChartCard title="Will we hit target?" subtitle="Projected full year as a share of target" className="md:col-span-2 xl:col-span-4" mobileHeight="h-[300px]">
          <TargetGauge state={forecast} />
        </ChartCard>
        <ChartCard title="Period by period" subtitle="Actuals where traded, projection where not" className="md:col-span-2 xl:col-span-12" mobileHeight="h-[460px]">
          <ProjectionTable state={forecast} />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}