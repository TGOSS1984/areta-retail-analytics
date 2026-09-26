"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/nav";
import { FilterBar } from "@/components/filters/FilterBar";

/** The banner every page other than the Overview opens with: the same
 * mountain image, overlay and padding as the Overview hero, the page's
 * question on the left and the filters on the right. A page's KPI strip
 * goes in as children and sits inside the banner, over the image, exactly
 * where the Overview's KPI cards sit, so every page opens the same way. */
export function PageHeader({ children }: { children?: React.ReactNode }) {
  const item = navItemFor(usePathname());
  return (
    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/10">
      <Image src="/images/hero-image-dark.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-terrain via-deep-terrain/75 to-deep-terrain/30" />
      <div className="relative flex flex-col gap-5 p-4 md:gap-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-summit-gold md:text-xs">{item?.label ?? "Areta"}</p>
            <h1 className="mt-2 max-w-md text-xl font-medium leading-snug text-cloud md:text-2xl">{item?.question}</h1>
            <div className="mt-3 h-px w-10 bg-summit-gold" />
          </div>
          <FilterBar />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Page body: header, KPI strip, then the chart grid. On fit screens the
 * whole thing is exactly the viewport and the grid takes what's left. */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 fit:h-full md:gap-5">{children}</div>;
}

/** The chart grid: one column on phones, two on tablets, twelve on
 * desktop, and on fit screens two equal rows that share the height. */
export function ChartGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-12 fit:min-h-0 fit:flex-1 fit:grid-rows-2">
      {children}
    </div>
  );
}