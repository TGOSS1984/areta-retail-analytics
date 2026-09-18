"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { useChannelMix } from "@/lib/hooks/useChannelMix";

export function ChannelMixChart() {
  const mix = useChannelMix();

  if (mix.status === "loading") {
    return <div className="h-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (mix.status === "error") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
        Couldn&apos;t load channel mix: {mix.message}
      </div>
    );
  }

  // Compact — this sits in a half-height slot split with the image
  // panel, not a full row-height slot like CategoryMixChart. DonutChart
  // itself doesn't need to know that: it just fills whatever box this
  // component's layout gives it.
  return <DonutChart title="Sales by channel" slices={mix.data} />;
}