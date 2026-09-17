"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useRegionalSales } from "@/lib/hooks/useRegionalSales";
import europeGeoJson from "@/lib/geo/europe-markets.json";

const MAP_NAME = "europe-markets";
const MIN_BUBBLE = 8;
const MAX_BUBBLE = 55;

// Registered once at module load, synchronously — not inside a
// useEffect with an async dynamic import. The first version did that
// and produced a real bug: the map rendered as a tiny, misshapen,
// disconnected fragment while the scatter bubbles rendered as one giant
// blob nowhere near it — the two series ended up resolving against
// different coordinate scales, most likely because of the timing gap
// between "component first renders with mapReady=false" and "map
// actually registers a tick later". A static import + registering
// before the component ever renders removes that gap entirely — the
// geojson is a known local file, there was never a real reason for it
// to be async.
if (!echarts.getMap(MAP_NAME)) {
  echarts.registerMap(MAP_NAME, europeGeoJson as unknown as Parameters<typeof echarts.registerMap>[1]);
}

export function RegionalMapChart() {
  const sales = useRegionalSales();

  if (sales.status === "loading") {
    return <div className="h-96 animate-pulse rounded-xl bg-alpine-stone/40" />;
  }

  if (sales.status === "error") {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-alpine-stone/20 p-4 text-center text-sm text-stone">
        Couldn&apos;t load regional sales: {sales.message}
      </div>
    );
  }

  const points = sales.data;
  const maxSales = Math.max(...points.map((p) => p.salesGbp));

  const option = {
    textStyle: { fontFamily: "Montserrat, sans-serif" },
    tooltip: {
      trigger: "item",
      formatter: (params: { name: string; value?: [number, number, number] }) =>
        params.value
          ? `${params.name}: £${(params.value[2] / 1_000_000).toFixed(2)}M`
          : params.name,
    },
    geo: {
      map: MAP_NAME,
      roam: true,
      // Explicit layout rather than relying on ECharts' auto-fit margins
      // — the auto-fit was very likely the actual source of the "tiny
      // map crammed in a corner" symptom. layoutCenter/layoutSize is the
      // standard, well-documented fix for exactly that: it forces the
      // map to a known size and position regardless of the container's
      // aspect ratio, rather than ECharts guessing from left/top/right/
      // bottom margins.
      layoutCenter: ["50%", "50%"],
      layoutSize: "95%",
      itemStyle: { areaColor: "#E8E1D6", borderColor: "#ffffff", borderWidth: 1 },
      emphasis: { itemStyle: { areaColor: "#D0AA62" }, label: { show: false } },
    },
    series: [
      {
        name: "Sales",
        type: "effectScatter",
        coordinateSystem: "geo",
        geoIndex: 0,
        data: points.map((p) => ({
          name: p.marketName,
          value: [p.lon, p.lat, p.salesGbp],
        })),
        symbolSize: (val: [number, number, number]) => {
          const size = Math.sqrt(val[2] / maxSales) * MAX_BUBBLE;
          return Number.isFinite(size) ? Math.max(MIN_BUBBLE, size) : MIN_BUBBLE;
        },
        showEffectOn: "render",
        rippleEffect: { brushType: "stroke" },
        itemStyle: {
          color: "#1F7486",
          shadowBlur: 6,
          shadowColor: "rgba(31, 116, 134, 0.4)",
        },
      },
    ],
  };

  return (
    <div className="rounded-xl bg-white p-5">
      <h2 className="mb-2 text-sm font-medium text-charcoal">Sales by market</h2>
      <ReactECharts option={option} style={{ height: 380 }} notMerge />
    </div>
  );
}