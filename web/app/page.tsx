import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { CategoryMixChart } from "@/components/charts/CategoryMixChart";
import { ChannelMixChart } from "@/components/charts/ChannelMixChart";

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen bg-cloud">
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

        {/* Regional map and top products still need groundwork that
            doesn't exist yet: a product-level export for the latter
            (fact_sales_daily only goes down to division, not style),
            a map-rendering approach for the former (dim_store now has
            lat/long, but nothing here renders a map yet). */}
        <div className="mt-6 rounded-xl border border-dashed border-rock-slate/30 p-8 text-center text-sm text-stone">
          Regional map, top products — still need groundwork that doesn&apos;t exist yet.
        </div>
      </main>
    </div>
  );
}