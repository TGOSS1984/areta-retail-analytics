"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { useCategoryMix } from "@/lib/hooks/useCategoryMix";

export function CategoryMixChart() {
  const mix = useCategoryMix();

  if (mix.status === "loading") {
    return <div className="h-[276px] animate-pulse rounded-xl bg-alpine-stone/40" />;
  }

  if (mix.status === "error") {
    return (
      <div className="flex h-[276px] items-center justify-center rounded-xl bg-alpine-stone/20 p-4 text-center text-sm text-stone">
        Couldn&apos;t load category mix: {mix.message}
      </div>
    );
  }

  return <DonutChart title="Sales by category" slices={mix.data} />;
}