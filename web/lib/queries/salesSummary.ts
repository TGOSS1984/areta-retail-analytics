import { queryDuckDB } from "@/lib/duckdb";

export type SalesSummary = {
  currentYear: number;
  maxPeriod: number;
  totalSalesGbp: number;
  totalUnits: number;
  grossMarginPct: number;
  retailSalesGbp: number;
  concessionSalesGbp: number;
  deltaVsLastYear: {
    totalSalesPct: number;
    totalUnitsPct: number;
    grossMarginPp: number;
    retailSalesPct: number;
    concessionSalesPct: number;
  };
};

type YearAggregate = {
  total_sales: number;
  total_units: number;
  total_cost: number;
  retail_sales: number;
  concession_sales: number;
};

function pctDelta(current: number, prior: number): number {
  return ((current - prior) / prior) * 100;
}

async function aggregateForYear(year: number, maxPeriod: number): Promise<YearAggregate> {
  const rows = await queryDuckDB<YearAggregate>(`
    SELECT
      CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS total_sales,
      CAST(SUM(f.quantity) AS DOUBLE) AS total_units,
      CAST(SUM(f.cost_gbp) AS DOUBLE) AS total_cost,
      CAST(SUM(f.net_sales_gbp) FILTER (WHERE s.channel = 'Retail') AS DOUBLE) AS retail_sales,
      CAST(SUM(f.net_sales_gbp) FILTER (WHERE s.channel = 'Concession') AS DOUBLE) AS concession_sales
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE d.business_year = ${year} AND d.business_period_number <= ${maxPeriod}
  `);
  return rows[0];
}

/**
 * Like-for-like YTD vs LY: same elapsed business periods in both years,
 * not partial-current-year vs full-prior-year (that comparison shipped
 * wrong once already in Hero.tsx's static placeholder — a -48% delta
 * that was actually just fewer months elapsed, not a real decline; see
 * that component's git history). This SQL was verified against the real
 * exported Parquet files with DuckDB's Python bindings before being
 * ported here, and reproduces those same validated figures.
 */
export async function fetchSalesSummary(): Promise<SalesSummary> {
  const yearRows = await queryDuckDB<{ current_year: number }>(`
    SELECT CAST(MAX(d.business_year) AS INTEGER) AS current_year
    FROM fact_sales_daily f JOIN dim_date d ON f.date = d.full_date
  `);
  const currentYear = yearRows[0].current_year;

  const periodRows = await queryDuckDB<{ max_period: number }>(`
    SELECT CAST(MAX(d.business_period_number) AS INTEGER) AS max_period
    FROM fact_sales_daily f
    JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = ${currentYear}
  `);
  const maxPeriod = periodRows[0].max_period;

  const [cur, prev] = await Promise.all([
    aggregateForYear(currentYear, maxPeriod),
    aggregateForYear(currentYear - 1, maxPeriod),
  ]);

  const curMargin = 1 - cur.total_cost / cur.total_sales;
  const prevMargin = 1 - prev.total_cost / prev.total_sales;

  return {
    currentYear,
    maxPeriod,
    totalSalesGbp: cur.total_sales,
    totalUnits: cur.total_units,
    grossMarginPct: curMargin * 100,
    retailSalesGbp: cur.retail_sales,
    concessionSalesGbp: cur.concession_sales,
    deltaVsLastYear: {
      totalSalesPct: pctDelta(cur.total_sales, prev.total_sales),
      totalUnitsPct: pctDelta(cur.total_units, prev.total_units),
      grossMarginPp: (curMargin - prevMargin) * 100,
      retailSalesPct: pctDelta(cur.retail_sales, prev.retail_sales),
      concessionSalesPct: pctDelta(cur.concession_sales, prev.concession_sales),
    },
  };
}