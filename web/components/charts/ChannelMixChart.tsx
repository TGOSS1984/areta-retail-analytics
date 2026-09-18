"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { useChannelMix } from "@/lib/hooks/useChannelMix";

export function ChannelMixChart() {
  const mix = useChannelMix();

  if (mix.status === "loading") {
    return <div className="h-[276px] animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (mix.status === "error") {
    return (
      <div className="flex h-[276px] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
        Couldn&apos;t load channel mix: {mix.message}
      </div>
    );
  }

  return <DonutChart title="Sales by channel" slices={mix.data} />;
}