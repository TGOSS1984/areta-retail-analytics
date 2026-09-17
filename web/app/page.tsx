import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { CategoryMixChart } from "@/components/charts/CategoryMixChart";
import { ChannelMixChart } from "@/components/charts/ChannelMixChart";
import { RegionalMapChart } from "@/components/charts/RegionalMapChart";

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

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RegionalMapChart />
          </div>

          {/* Top products still needs groundwork that doesn't exist yet:
              fact_sales_daily only goes down to division, not style —
              a product-level export, and the product-image sourcing
              question, both need their own dedicated pass. */}
          <div className="flex items-center justify-center rounded-xl border border-dashed border-rock-slate/30 p-8 text-center text-sm text-stone">
            Top products — needs a product-level export and the image
            sourcing question resolved first.
          </div>
        </div>
      </main>
    </div>
  );
}