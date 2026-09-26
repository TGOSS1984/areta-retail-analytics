import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { marketAnd, tyDates } from "@/lib/filters/sql";

export type RegionPoint = {
  region: string;
  lat: number;
  lon: number;
  salesGbp: number;
};

/**
 * Same YTD-bounds pattern as regionalSales.ts, scoped down to one
 * market and grouped by dim_store.region instead of market_code.
 * Position is the average of that region's own stores' coordinates —
 * same "derived from dim_store, not a second independently-maintained
 * position dataset" reasoning as the market-level map.
 *
 * marketCode is interpolated directly into the SQL like every other
 * value in this codebase's query files (queryDuckDB takes a raw
 * string, no parameter binding) — safe here because the only call site
 * (RegionalMapChart.tsx) passes a hardcoded literal ("UK"), never
 * anything from a user-facing input.
 */
export async function fetchRegionalSalesDrilldown(marketCode: string, f: ResolvedFilters): Promise<RegionPoint[]> {
  const rows = await queryDuckDB<{
    region: string;
    avg_lat: number;
    avg_lon: number;
    sales_gbp: number;
  }>(`
    SELECT
      s.region,
      CAST(AVG(s.latitude) AS DOUBLE) AS avg_lat,
      CAST(AVG(s.longitude) AS DOUBLE) AS avg_lon,
      CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE ${tyDates(f, "f.date")}
      AND s.market_code = '${marketCode}'
    GROUP BY s.region
    ORDER BY sales_gbp DESC
  `);

  return rows.map((r) => ({
    region: r.region,
    lat: r.avg_lat,
    lon: r.avg_lon,
    salesGbp: r.sales_gbp,
  }));
}