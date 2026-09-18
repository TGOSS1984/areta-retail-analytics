import { Sidebar } from "@/components/layout/Sidebar";
import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { CategoryMixChart } from "@/components/charts/CategoryMixChart";
import { ChannelMixChart } from "@/components/charts/ChannelMixChart";
import { RegionalMapChart } from "@/components/charts/RegionalMapChart";
import { TopProductsChart } from "@/components/charts/TopProductsChart";
import { SalesMarginByMonthChart } from "@/components/charts/SalesMarginByMonthChart";
import { ImagePanel } from "@/components/ui/ImagePanel";

export default function OverviewPage() {
  return (
    <div className="flex h-screen bg-abyss">
      <Sidebar active="Overview" />

      {/* h-screen + flex-col here, not min-h-screen: Hero takes its own
          natural height (it has a minHeight already) and the two chart
          rows below share whatever's left via flex-1, so the whole
          dashboard sizes itself to the viewport instead of stacking to
          a fixed height that may or may not fit. overflow-y-auto is the
          safety net, not the plan — if a viewport is ever too short for
          this to fit, a scrollbar appears rather than content silently
          clipping (which overflow-hidden would do). */}
      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto p-6">
        <div className="flex-shrink-0">
          <Hero />
        </div>

        <div className="mt-6 grid min-h-0 flex-1 grid-cols-3 gap-6">
          <SalesTrendChart />
          <ChannelMixChart />
          <RegionalMapChart />
        </div>

        <div className="mt-6 grid min-h-0 flex-1 grid-cols-3 gap-6">
          <TopProductsChart />
          <SalesMarginByMonthChart />

          {/* The 3rd row-2 slot, split: category mix (now the compact
              one here — see the swap note above) on top, a decorative
              brand panel below, matching the reference board's use of
              imagery to fill space rather than leaving it empty. */}
          <div className="flex min-h-0 flex-col gap-6">
            <div className="min-h-0 flex-1">
              <CategoryMixChart />
            </div>
            <div className="min-h-0 flex-1">
              <ImagePanel
                imageSrc="/images/feature-image.webp"
                heading="Built for the climb"
                subheading="Data drives higher ground"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}