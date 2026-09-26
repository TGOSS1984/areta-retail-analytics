import { Hero } from "@/components/layout/Hero";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { CategoryMixChart } from "@/components/charts/CategoryMixChart";
import { ChannelMixChart } from "@/components/charts/ChannelMixChart";
import { RegionalMapChart } from "@/components/charts/RegionalMapChart";
import { TopProductsChart } from "@/components/charts/TopProductsChart";
import { SalesMarginByMonthChart } from "@/components/charts/SalesMarginByMonthChart";
import { ImagePanel } from "@/components/ui/ImagePanel";

/** A grid cell with its own height where the page scrolls, and none on
 * "fit" screens, where the two rows share the viewport height instead. */
function Cell({ className = "", height = "h-[320px]", children }: { className?: string; height?: string; children: React.ReactNode }) {
  return <div className={`min-h-0 min-w-0 ${height} fit:h-auto ${className}`}>{children}</div>;
}

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6 fit:h-full">
      <div className="flex-shrink-0">
        <Hero />
      </div>

      {/* Same structure at every size, just re-flowed: one column on
          phones, two on tablets (the wide trend chart spanning both), and
          the reference board's three-by-two on desktop. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 fit:min-h-0 fit:flex-1">
        <Cell className="md:col-span-2 xl:col-span-1">
          <SalesTrendChart />
        </Cell>
        <Cell>
          <ChannelMixChart />
        </Cell>
        <Cell height="h-[360px]">
          <RegionalMapChart />
        </Cell>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3 fit:min-h-0 fit:flex-1">
        <Cell height="h-[440px]">
          <TopProductsChart />
        </Cell>
        <Cell>
          <SalesMarginByMonthChart />
        </Cell>
        {/* Category mix over a brand image panel, as on the reference
            board. On tablets this pair spans both columns side by side. */}
        <div className="grid min-h-0 grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2 md:gap-6 xl:col-span-1 xl:grid-cols-1 fit:grid-rows-2">
          <Cell height="h-[280px]">
            <CategoryMixChart />
          </Cell>
          <Cell height="h-[180px] md:h-[280px] xl:h-[200px]">
            <ImagePanel
              imageSrc="/images/feature-image.webp"
              heading="Built for the climb"
              subheading="Data drives higher ground"
            />
          </Cell>
        </div>
      </div>
    </div>
  );
}