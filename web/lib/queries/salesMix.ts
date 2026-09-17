import { queryDuckDB } from "@/lib/duckdb";

export type MixSlice = { label: string; salesGbp: number; pct: number };

function withPercentages(rows: { label: string; sales_gbp: number }[]): MixSlice[] {
  const total = rows.reduce((sum, r) => sum + r.sales_gbp, 0);
  return rows.map((r) => ({
    label: r.label,
    salesGbp: r.sales_gbp,
    pct: total > 0 ? (r.sales_gbp / total) * 100 : 0,
  }));
}

/** Same like-for-like YTD bounds as salesSummary.ts and monthlyTrend.ts —
 * current business year, elapsed periods only. Not shared code with
 * those two because the queries that use it differ enough (different
 * tables joined) that a shared function would need to take the query
 * shape as a parameter, which isn't simpler than three short copies of
 * eight lines of SQL. */
async function currentYtdBounds(): Promise<{ year: number; maxPeriod: number }> {
  const yearRows = await queryDuckDB<{ current_year: number }>(`
    SELECT CAST(MAX(d.business_year) AS INTEGER) AS current_year
    FROM fact_sales_daily f JOIN dim_date d ON f.date = d.full_date
  `);
  const year = yearRows[0].current_year;

  const periodRows = await queryDuckDB<{ max_period: number }>(`
    SELECT CAST(MAX(d.business_period_number) AS INTEGER) AS max_period
    FROM fact_sales_daily f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = ${year}
  `);
  return { year, maxPeriod: periodRows[0].max_period };
}

export async function fetchCategoryMix(): Promise<MixSlice[]> {
  const { year, maxPeriod } = await currentYtdBounds();
  const rows = await queryDuckDB<{ label: string; sales_gbp: number }>(`
    SELECT f.division AS label, CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = ${year} AND d.business_period_number <= ${maxPeriod}
    GROUP BY f.division
    ORDER BY sales_gbp DESC
  `);
  return withPercentages(rows);
}

export async function fetchChannelMix(): Promise<MixSlice[]> {
  const { year, maxPeriod } = await currentYtdBounds();
  const rows = await queryDuckDB<{ label: string; sales_gbp: number }>(`
    SELECT s.channel AS label, CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS sales_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE d.business_year = ${year} AND d.business_period_number <= ${maxPeriod}
    GROUP BY s.channel
    ORDER BY sales_gbp DESC
  `);
  return withPercentages(rows);
}