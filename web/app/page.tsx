import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";

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

          {/* Category mix and channel mix donuts are the fast follow-up
              to this — same DuckDB-wasm/ECharts pattern now that it's
              proven working, just a different query and chart type.
              Regional map and top products need more first: a new
              product-level export for the latter, a map approach for
              the former — neither exists yet. */}
          <div className="rounded-xl border border-dashed border-rock-slate/30 p-8 text-center text-sm text-stone">
            Category mix, channel mix — next up, same pattern as the trend
            chart. Regional map and top products need more groundwork first.
          </div>
        </div>
      </main>
    </div>
  );
}