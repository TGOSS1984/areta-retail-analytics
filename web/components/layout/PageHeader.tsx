"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/nav";
import { FilterBar } from "@/components/filters/FilterBar";

/** Compact version of the Overview hero for every other page: the same
 * mountain image and gold eyebrow, the page's question, and the filters. */
export function PageHeader() {
  const item = navItemFor(usePathname());
  return (
    <div className="relative flex-shrink-0 overflow-hidden rounded-2xl border border-white/10">
      <Image src="/images/hero-image-dark.webp" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-terrain via-deep-terrain/85 to-deep-terrain/40" />
      <div className="relative flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-summit-gold">{item?.label ?? "Areta"}</p>
          <h1 className="mt-1 text-lg font-medium leading-snug text-cloud md:text-xl">{item?.question}</h1>
          <div className="mt-2 h-px w-8 bg-summit-gold" />
        </div>
        <FilterBar />
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