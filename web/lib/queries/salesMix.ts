import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { marketAnd, tyDates } from "@/lib/filters/sql";

export type MixSlice = { label: string; salesGbp: number; pct: number };

function withPercentages(rows: { label: string; sales_gbp: number }[]): MixSlice[] {
  const total = rows.reduce((sum, r) => sum + r.sales_gbp, 0);
  return rows.map((r) => ({
    label: r.label,
    salesGbp: r.sales_gbp,
    pct: total > 0 ? (r.sales_gbp / total) * 100 : 0,
  }));
}

export async function fetchCategoryMix(f: ResolvedFilters): Promise<MixSlice[]> {
  const rows = await queryDuckDB<{ label: string; sales_gbp: number }>(`
    SELECT x.division AS label, CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "s")}
    GROUP BY x.division
    ORDER BY sales_gbp DESC
  `);
  return withPercentages(rows);
}

export async function fetchChannelMix(f: ResolvedFilters): Promise<MixSlice[]> {
  const rows = await queryDuckDB<{ label: string; sales_gbp: number }>(`
    SELECT s.channel AS label, CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "s")}
    GROUP BY s.channel
    ORDER BY sales_gbp DESC
  `);
  return withPercentages(rows);
}