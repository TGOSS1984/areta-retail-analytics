import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { marketAnd } from "@/lib/filters/sql";

export type MonthlyTrendPoint = {
  monthNum: number;
  monthName: string;
  currentYearSales: number | null;
  priorYearSales: number | null;
};

export type MonthlyTrend = {
  currentYear: number;
  priorYear: number;
  points: MonthlyTrendPoint[];
  /** Set when the trailing month of the current year got excluded for
   * being incomplete — surfaced so the UI can footnote it rather than
   * silently drop data with no explanation. */
  excludedPartialMonth?: string;
};

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

/**
 * Calendar-year month-by-month trend, not business-year — this is the
 * one visual on the page using the calendar calendar rather than the
 * business one. Financial reporting (targets, contribution) needs the
 * business year; a general "sales through the year" trend line reads
 * more naturally in calendar months to anyone glancing at the page, and
 * nothing here depends on business-period boundaries.
 *
 * The trailing month of the current year is checked for completeness
 * and excluded if partial — plotting a mid-month total next to twelve
 * full months creates a fake-looking crash at the end of the line,
 * exactly the same class of mistake as the like-for-like fix already
 * made in salesSummary.ts. Verified this against the real exported data
 * before writing it: the last date present was 2026-09-16, day 16 of a
 * 30-day month — genuinely incomplete, not an edge case that won't occur.
 */
export async function fetchMonthlyTrend(f: ResolvedFilters): Promise<MonthlyTrend> {
  const yearRows = await queryDuckDB<{ cal_year: number }>(`
    SELECT CAST(MAX(d.calendar_year) AS INTEGER) AS cal_year
    FROM fact_sales_daily f JOIN dim_date d ON f.date = d.full_date
  `);
  const currentYear = yearRows[0].cal_year;
  const priorYear = currentYear - 1;

  const lastDateRows = await queryDuckDB<{ last_date: string }>(`
    SELECT MAX(f.date) AS last_date FROM fact_sales_daily f
  `);
  const lastDate = new Date(lastDateRows[0].last_date);
  const lastYear = lastDate.getFullYear();
  const lastMonthNum = lastDate.getMonth() + 1;
  const isTrailingMonthPartial =
    lastYear === currentYear && lastDate.getDate() < daysInMonth(lastYear, lastMonthNum);

  const rows = await queryDuckDB<{
    month_num: number;
    month_name: string;
    calendar_year: number;
    net_sales_gbp: number;
  }>(`
    SELECT d.month_num, d.month_name, CAST(d.calendar_year AS INTEGER) AS calendar_year,
           CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS net_sales_gbp
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE d.calendar_year IN (${currentYear}, ${priorYear}) ${marketAnd(f, "s")}
    GROUP BY d.month_num, d.month_name, d.calendar_year
    ORDER BY d.month_num
  `);

  const byMonth = new Map<number, { name: string; current: number | null; prior: number | null }>();
  for (const row of rows) {
    const isExcludedPartial =
      isTrailingMonthPartial && row.calendar_year === currentYear && row.month_num === lastMonthNum;

    const entry = byMonth.get(row.month_num) ?? { name: row.month_name, current: null, prior: null };
    if (row.calendar_year === currentYear && !isExcludedPartial) {
      entry.current = row.net_sales_gbp;
    } else if (row.calendar_year === priorYear) {
      entry.prior = row.net_sales_gbp;
    }
    byMonth.set(row.month_num, entry);
  }

  const points: MonthlyTrendPoint[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthNum, v]) => ({
      monthNum,
      monthName: v.name,
      currentYearSales: v.current,
      priorYearSales: v.prior,
    }));

  return {
    currentYear,
    priorYear,
    points,
    excludedPartialMonth: isTrailingMonthPartial ? points.find((p) => p.monthNum === lastMonthNum)?.monthName : undefined,
  };
}