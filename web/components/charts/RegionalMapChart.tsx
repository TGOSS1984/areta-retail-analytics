"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useRegionalSales } from "@/lib/hooks/useRegionalSales";
import { useRegionalSalesDrilldown } from "@/lib/hooks/useRegionalSalesDrilldown";
import europeGeoJson from "@/lib/geo/europe-markets.json";

const MAP_NAME = "europe-markets";
const UK_MAP_NAME = "uk-only";
const MIN_BUBBLE = 8;
const MAX_BUBBLE = 55;

// Registered once at module load, synchronously — not inside a
// useEffect with an async dynamic import. The first version did that
// and produced a real bug: the map rendered as a tiny, misshapen,
// disconnected fragment while the scatter bubbles rendered as one giant
// blob nowhere near it — the two series ended up resolving against
// different coordinate scales, most likely because of the timing gap
// between \"component first renders with mapReady=false\" and \"map
// actually registers a tick later\". A static import + registering
// before the component ever renders removes that gap entirely — the
// geojson is a known local file, there was never a real reason for it
// to be async.
if (!echarts.getMap(MAP_NAME)) {
  echarts.registerMap(MAP_NAME, europeGeoJson as unknown as Parameters<typeof echarts.registerMap>[1]);
}

// The UK drilldown reuses the UK feature already sitting inside
// europe-markets.json rather than shipping a second GeoJSON file — same
// "one real dataset, not a hand-maintained duplicate" reasoning as
// deriving bubble positions from dim_store instead of hand-picked
// centroids. Registered once, synchronously, same reasoning as above.
const ukFeature = (europeGeoJson as { features: Array<{ properties: { market_code: string } }> }).features.find(
  (f) => f.properties.market_code === "UK",
);
if (ukFeature && !echarts.getMap(UK_MAP_NAME)) {
  echarts.registerMap(UK_MAP_NAME, {
    type: "FeatureCollection",
    features: [ukFeature],
  } as unknown as Parameters<typeof echarts.registerMap>[1]);
}

export function RegionalMapChart() {
  const [drilldown, setDrilldown] = useState<"europe" | "uk">("europe");
  const europeSales = useRegionalSales();
  const ukSales = useRegionalSalesDrilldown("UK", drilldown === "uk");

  const onEvents = useMemo(
    () => ({
      click: (params: { name?: string }) => {
        // Fires on either the country shape (geo component) or the
        // bubble (scatter series) — both carry the same name string
        // ("United Kingdom", matching dim_store's market_name), so one
        // check covers both click targets.
        if (drilldown === "europe" && params.name === "United Kingdom") {
          setDrilldown("uk");
        }
      },
    }),
    [drilldown],
  );

  // Branched on the SAME variable used to build `points` below, not a
  // merged union — a merged `sales = drilldown === "uk" ? ukSales :
  // europeSales` compiles fine but loses TypeScript's ability to
  // correlate `drilldown` with which hook's data it actually holds
  // (caught by a real tsc run, not assumed).
  let points: { name: string; lat: number; lon: number; salesGbp: number }[];
  if (drilldown === "uk") {
    if (ukSales.status === "loading") {
      return <div className="h-96 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
    }
    if (ukSales.status === "error") {
      return (
        <div className="flex h-96 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
          Couldn&apos;t load regional sales: {ukSales.message}
        </div>
      );
    }
    points = ukSales.data.map((p) => ({ name: p.region, lat: p.lat, lon: p.lon, salesGbp: p.salesGbp }));
  } else {
    if (europeSales.status === "loading") {
      return <div className="h-96 animate-pulse rounded-xl border border-white/10 bg-white/5" />;
    }
    if (europeSales.status === "error") {
      return (
        <div className="flex h-96 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
          Couldn&apos;t load regional sales: {europeSales.message}
        </div>
      );
    }
    points = europeSales.data.map((p) => ({ name: p.marketName, lat: p.lat, lon: p.lon, salesGbp: p.salesGbp }));
  }
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
      map: drilldown === "uk" ? UK_MAP_NAME : MAP_NAME,
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
      itemStyle: { areaColor: "#4A5B63", borderColor: "rgba(255,255,255,0.25)", borderWidth: 1 },
      emphasis: { itemStyle: { areaColor: "#D0AA62" }, label: { show: false } },
    },
    series: [
      {
        name: "Sales",
        type: "effectScatter",
        coordinateSystem: "geo",
        geoIndex: 0,
        data: points.map((p) => ({
          name: p.name,
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
    <div className="rounded-xl border border-white/10 bg-deep-terrain p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-cloud">
          {drilldown === "uk" ? "Sales by region — United Kingdom" : "Sales by market"}
        </h2>
        {drilldown === "uk" && (
          <button
            type="button"
            onClick={() => setDrilldown("europe")}
            className="text-xs font-medium text-summit-gold hover:underline"
          >
            &larr; All markets
          </button>
        )}
      </div>
      {drilldown === "europe" && (
        <p className="mb-2 -mt-1 text-xs text-mist">Click the UK to see the regional breakdown</p>
      )}
      <ReactECharts option={option} style={{ height: 380 }} onEvents={onEvents} notMerge />
    </div>
  );
}