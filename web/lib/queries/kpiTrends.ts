import { queryDuckDB } from "@/lib/duckdb";

export type KpiTrends = {
  totalSales: number[];
  totalUnits: number[];
  grossMarginPct: number[];
  retailSales: number[];
  concessionSales: number[];
  onlineSales: number[];
};

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

/**
 * Trailing 12 FULL calendar months (chronological), one number per
 * month per KPI card on Hero.tsx — the small shape behind each card's
 * headline figure, not a precisely-read chart. Same trailing-partial-
 * month exclusion as monthlyTrend.ts/salesMarginByMonth.ts: pulls 13
 * months with LIMIT so dropping a partial trailing one still leaves a
 * full 12, rather than a shorter, inconsistent-length sparkline.
 *
 * Deliberately calendar-month grain even though Hero's own headline
 * figures are business-year YTD — a sparkline's job is "what's the
 * recent shape", not a like-for-like figure, so the mismatch in time
 * basis between the number and the shape behind it is fine here in a
 * way it would NOT be fine for the number itself.
 */
export async function fetchKpiTrends(): Promise<KpiTrends> {
  const lastDateRows = await queryDuckDB<{ last_date: string }>(`
    SELECT MAX(f.date) AS last_date FROM fact_sales_daily f
  `);
  const lastDate = new Date(lastDateRows[0].last_date);
  const isTrailingMonthPartial = lastDate.getDate() < daysInMonth(lastDate.getFullYear(), lastDate.getMonth() + 1);

  const rows = await queryDuckDB<{
    month_start: string;
    net_sales_gbp: number;
    quantity: number;
    cost_gbp: number;
    retail_sales: number;
    concession_sales: number;
    online_sales: number;
  }>(`
    SELECT
      CAST(date_trunc('month', d.full_date) AS VARCHAR) AS month_start,
      CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS net_sales_gbp,
      CAST(SUM(f.quantity) AS DOUBLE) AS quantity,
      CAST(SUM(f.cost_gbp) AS DOUBLE) AS cost_gbp,
      CAST(SUM(f.net_sales_gbp) FILTER (WHERE s.channel = 'Retail') AS DOUBLE) AS retail_sales,
      CAST(SUM(f.net_sales_gbp) FILTER (WHERE s.channel = 'Concession') AS DOUBLE) AS concession_sales,
      CAST(SUM(f.net_sales_gbp) FILTER (WHERE s.channel = 'Online') AS DOUBLE) AS online_sales
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    GROUP BY date_trunc('month', d.full_date)
    ORDER BY month_start DESC
    LIMIT 13
  `);

  const chronological = rows.slice().reverse();
  // chronological is oldest-first, 13 months. If the newest is partial,
  // drop it (keep the oldest 12 of the 13 = the most recent 12 FULL
  // months). If the newest is complete, drop the oldest instead (keep
  // the newest 12 of the 13).
  const trimmed = isTrailingMonthPartial ? chronological.slice(0, 12) : chronological.slice(1);

  return {
    totalSales: trimmed.map((r) => r.net_sales_gbp),
    totalUnits: trimmed.map((r) => r.quantity),
    grossMarginPct: trimmed.map((r) => (r.net_sales_gbp > 0 ? (1 - r.cost_gbp / r.net_sales_gbp) * 100 : 0)),
    retailSales: trimmed.map((r) => r.retail_sales),
    concessionSales: trimmed.map((r) => r.concession_sales),
    onlineSales: trimmed.map((r) => r.online_sales),
  };
}