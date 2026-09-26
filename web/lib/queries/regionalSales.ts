import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { marketAnd, tyDates } from "@/lib/filters/sql";

export type MarketPoint = {
  marketCode: string;
  marketName: string;
  lat: number;
  lon: number;
  salesGbp: number;
};

/**
 * Market-level, not sub-country region-level — a deliberate scope choice
 * for this first version. The GeoJSON this feeds (lib/geo/europe-markets.geojson)
 * has country-level boundaries for the 11 markets, which is the natural
 * match for market-grain bubbles. A UK-specific regional breakdown
 * (North West, Scotland, etc, matching the original mockup) is a
 * plausible next step, but a second thing to get right, not this one.
 *
 * Position is the average of that market's own stores' coordinates, not
 * a hand-picked country centroid — consistent with the "derived from
 * dim_store, not a second independently-maintained position" decision
 * made when lat/long was added there.
 */
export async function fetchRegionalSales(f: ResolvedFilters): Promise<MarketPoint[]> {
  const rows = await queryDuckDB<{
    market_code: string;
    market_name: string;
    avg_lat: number;
    avg_lon: number;
    sales_gbp: number;
  }>(`
    SELECT
      s.market_code,
      s.market_name,
      CAST(AVG(s.latitude) AS DOUBLE) AS avg_lat,
      CAST(AVG(s.longitude) AS DOUBLE) AS avg_lon,
      CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE ${tyDates(f, "f.date")} ${marketAnd(f, "s")}
    GROUP BY s.market_code, s.market_name
    ORDER BY sales_gbp DESC
  `);

  return rows.map((r) => ({
    marketCode: r.market_code,
    marketName: r.market_name,
    lat: r.avg_lat,
    lon: r.avg_lon,
    salesGbp: r.sales_gbp,
  }));
}