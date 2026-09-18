import { queryDuckDB } from "@/lib/duckdb";

export type SalesMarginPoint = {
  monthNum: number;
  monthName: string;
  salesGbp: number;
  marginPct: number;
};

export type SalesMarginByMonth = {
  year: number;
  points: SalesMarginPoint[];
  /** Set when the trailing month got excluded for being incomplete —
   * same reasoning as monthlyTrend.ts's excludedPartialMonth. */
  excludedPartialMonth?: string;
};

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

/**
 * Calendar-year month-by-month sales (bars) and gross margin % (line)
 * for one selected year — same calendar-not-business-year choice as
 * monthlyTrend.ts and the same reasoning: a general "sales through the
 * year" view reads naturally in calendar months, nothing here depends
 * on business-period boundaries. Same trailing-partial-month exclusion
 * logic as monthlyTrend.ts too (plotting a mid-month total next to full
 * months creates a fake-looking crash) — not shared code with it, same
 * reason as elsewhere in this codebase: different shape (one year here,
 * current-vs-prior there), a shared helper would need the shape passed
 * in, which isn't simpler than repeating the logic.
 */
export async function fetchSalesMarginByMonth(year: number): Promise<SalesMarginByMonth> {
  const lastDateRows = await queryDuckDB<{ last_date: string }>(`
    SELECT MAX(f.date) AS last_date FROM fact_sales_daily f
  `);
  const lastDate = new Date(lastDateRows[0].last_date);
  const lastYear = lastDate.getFullYear();
  const lastMonthNum = lastDate.getMonth() + 1;
  const isTrailingMonthPartial = lastYear === year && lastDate.getDate() < daysInMonth(lastYear, lastMonthNum);

  const rows = await queryDuckDB<{
    month_num: number;
    month_name: string;
    net_sales_gbp: number;
    cost_gbp: number;
  }>(`
    SELECT d.month_num, d.month_name,
           CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS net_sales_gbp,
           CAST(SUM(f.cost_gbp) AS DOUBLE) AS cost_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    WHERE d.calendar_year = ${year}
    GROUP BY d.month_num, d.month_name
    ORDER BY d.month_num
  `);

  const points: SalesMarginPoint[] = rows
    .filter((r) => !(isTrailingMonthPartial && r.month_num === lastMonthNum))
    .map((r) => ({
      monthNum: r.month_num,
      monthName: r.month_name,
      salesGbp: r.net_sales_gbp,
      marginPct: r.net_sales_gbp > 0 ? (1 - r.cost_gbp / r.net_sales_gbp) * 100 : 0,
    }));

  return {
    year,
    points,
    excludedPartialMonth: isTrailingMonthPartial
      ? rows.find((r) => r.month_num === lastMonthNum)?.month_name
      : undefined,
  };
}

/** Distinct calendar years that actually have sales data — powers the
 * chart's year filter. Queried rather than hardcoded so a future
 * generator re-run that extends the date range doesn't silently leave
 * the filter stale. */
export async function fetchAvailableYears(): Promise<number[]> {
  const rows = await queryDuckDB<{ calendar_year: number }>(`
    SELECT DISTINCT CAST(d.calendar_year AS INTEGER) AS calendar_year
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    ORDER BY calendar_year DESC
  `);
  return rows.map((r) => r.calendar_year);
}