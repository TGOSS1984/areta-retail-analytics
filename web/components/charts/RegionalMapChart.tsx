"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useRegionalSales } from "@/lib/hooks/useRegionalSales";

const MAP_NAME = "europe-markets";
const MIN_BUBBLE = 8;
const MAX_BUBBLE = 55;

export function RegionalMapChart() {
  const sales = useRegionalSales();
  const [mapReady, setMapReady] = useState(false);

  // registerMap needs to run once, client-side, before the chart can
  // reference the map name — importing the trimmed GeoJSON as a normal
  // JSON module rather than fetching it, since it's a local project file
  useEffect(() => {
    if (echarts.getMap(MAP_NAME)) {
      setMapReady(true);
      return;
    }
    import("@/lib/geo/europe-markets.json")
      .then((mod) => {
        echarts.registerMap(MAP_NAME, mod.default as unknown as Parameters<typeof echarts.registerMap>[1]);
        setMapReady(true);
      })
      .catch(() => setMapReady(false));
  }, []);

  if (sales.status === "loading" || !mapReady) {
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
      formatter: (params: { name: string; value: [number, number, number] }) =>
        params.value
          ? `${params.name}: £${(params.value[2] / 1_000_000).toFixed(2)}M`
          : params.name,
    },
    geo: {
      map: MAP_NAME,
      roam: true,
      zoom: 1.1,
      itemStyle: { areaColor: "#E8E1D6", borderColor: "#ffffff", borderWidth: 1 },
      emphasis: { itemStyle: { areaColor: "#D0AA62" }, label: { show: false } },
    },
    series: [
      {
        name: "Sales",
        type: "effectScatter",
        coordinateSystem: "geo",
        data: points.map((p) => ({
          name: p.marketName,
          value: [p.lon, p.lat, p.salesGbp],
        })),
        symbolSize: (val: [number, number, number]) =>
          Math.max(MIN_BUBBLE, Math.sqrt(val[2] / maxSales) * MAX_BUBBLE),
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