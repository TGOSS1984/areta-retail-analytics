"use client";

import { PageFrame, PageHeader, ChartGrid } from "@/components/layout/PageHeader";
import { ChartCard } from "@/components/ui/ChartCard";
import { DigitalKpis } from "@/components/digital/DigitalKpis";
import { SessionsByDeviceArea } from "@/components/digital/SessionsByDeviceArea";
import { DeviceConversionChart } from "@/components/digital/DeviceConversionChart";
import { MarketDeviceHeatmap } from "@/components/digital/MarketDeviceHeatmap";
import { BrowserShareBars } from "@/components/digital/BrowserShareBars";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchDigitalSummary } from "@/lib/queries/digitalPage";

export default function DigitalPage() {
  const summary = useFilteredData(fetchDigitalSummary);
  return (
    <PageFrame>
      <PageHeader>
        <DigitalKpis state={summary} />
      </PageHeader>
      <ChartGrid>
        <ChartCard title="Sessions by device" subtitle="Weekly, stacked" className="md:col-span-2 xl:col-span-7">
          <SessionsByDeviceArea />
        </ChartCard>
        <ChartCard title="Traffic vs conversion" subtitle="Sessions and conversion by device · hollow dots are last year" className="md:col-span-2 xl:col-span-5">
          <DeviceConversionChart />
        </ChartCard>
        <ChartCard title="Conversion by market and device" subtitle="Orders over sessions" className="xl:col-span-7" mobileHeight="h-[420px]">
          <MarketDeviceHeatmap />
        </ChartCard>
        <ChartCard title="Browsers" subtitle="Share of sessions" className="xl:col-span-5" mobileHeight="h-[260px]">
          <BrowserShareBars />
        </ChartCard>
      </ChartGrid>
    </PageFrame>
  );
}