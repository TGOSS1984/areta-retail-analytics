"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { DataKpis } from "@/components/data/DataKpis";
import { ChecksByCategory } from "@/components/data/ChecksByCategory";
import { Reconciliations } from "@/components/data/Reconciliations";
import { FreshnessTable } from "@/components/data/FreshnessTable";
import { ChecksTable } from "@/components/data/ChecksTable";
import { useAsyncData } from "@/lib/hooks/useAsyncData";
import { fetchDqChecks, fetchDqTables } from "@/lib/queries/dataPage";

export default function DataPage() {
  // The audit describes the whole warehouse, so this page reads it
  // directly rather than through the date and market filters.
  const checks = useAsyncData(fetchDqChecks);
  const tables = useAsyncData(fetchDqTables);

  return (
    <PageFrame>
      <PageHeader filters={false}>
        <DataKpis checks={checks} tables={tables} />
      </PageHeader>
      <ChartGrid>
        <ChartCard title="Checks by category" subtitle="Scored checks only" className="xl:col-span-4" mobileHeight="h-[260px]">
          <ChecksByCategory state={checks} />
        </ChartCard>
        <ChartCard title="Reconciliations" subtitle="The same total from two tables" className="xl:col-span-4" mobileHeight="h-[340px]">
          <Reconciliations state={checks} />
        </ChartCard>
        <ChartCard title="Tables" subtitle="Size, completeness and freshness" className="md:col-span-2 xl:col-span-4" mobileHeight="h-[360px]">
          <FreshnessTable state={tables} />
        </ChartCard>
        <ChartCard title="Every check" subtitle="Click a row for what it tests" className="md:col-span-2 xl:col-span-12" mobileHeight="h-[460px]">
          <ChecksTable state={checks} />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}