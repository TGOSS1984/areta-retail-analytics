import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen bg-cloud">
      <Sidebar active="Overview" />

      <main className="flex-1 p-6">
        <Hero />

        {/* Chart grid (sales trend, category mix, regional map, top
            products, channel split) comes in the next pass, once the
            DuckDB-wasm data layer exists to feed it — deliberately not
            faking that content with static numbers here. */}
        <div className="mt-6 rounded-xl border border-dashed border-rock-slate/30 p-8 text-center text-sm text-stone">
          Chart grid — sales trend, category mix, regional map, top products —
          lands once data/exports and the DuckDB-wasm wiring exist.
        </div>
      </main>
    </div>
  );
}