"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { useCategoryMix } from "@/lib/hooks/useCategoryMix";

export function CategoryMixChart() {
  const mix = useCategoryMix();

  if (mix.status === "loading") {
    return <div className="h-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (mix.status === "error") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
        Couldn&apos;t load category mix: {mix.message}
      </div>
    );
  }

  return <DonutChart title="Sales by category" slices={mix.data} />;
}