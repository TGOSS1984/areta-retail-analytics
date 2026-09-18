import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { CategoryMixChart } from "@/components/charts/CategoryMixChart";
import { ChannelMixChart } from "@/components/charts/ChannelMixChart";
import { RegionalMapChart } from "@/components/charts/RegionalMapChart";
import { TopProductsChart } from "@/components/charts/TopProductsChart";
import { SalesMarginByMonthChart } from "@/components/charts/SalesMarginByMonthChart";

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen bg-abyss">
      <Sidebar active="Overview" />

      <main className="flex-1 p-6">
        <Hero />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesTrendChart />
          </div>

          <div className="flex flex-col gap-6">
            <CategoryMixChart />
            <ChannelMixChart />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RegionalMapChart />
          </div>

          <TopProductsChart />
        </div>

        <div className="mt-6">
          <SalesMarginByMonthChart />
        </div>
      </main>
    </div>
  );
}