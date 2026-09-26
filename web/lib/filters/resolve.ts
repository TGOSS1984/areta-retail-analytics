import { queryDuckDB } from "@/lib/duckdb";
import type { RawFilters, ResolvedFilters } from "@/lib/filters/filters";
import { addDays, daysBetweenInclusive, minDate } from "@/lib/filters/dates";

export type DataBounds = {
  lastDataDate: string;
  firstYear: number;
  latestYear: number;
  /** Last business period with any sales, per business year. */
  maxPeriodByYear: Record<number, number>;
  /** Every period's first and last day, keyed `${year}-${period}`. */
  periodDates: Record<string, { start: string; end: string; label: string }>;
  markets: { code: string; name: string }[];
};

let boundsPromise: Promise<DataBounds> | null = null;

/** What the data itself allows: which years and periods have sales, and
 * where each period starts and ends. Queried once and shared. */
export function fetchDataBounds(): Promise<DataBounds> {
  if (!boundsPromise) {
    boundsPromise = loadBounds();
    boundsPromise.catch(() => {
      boundsPromise = null;
    });
  }
  return boundsPromise;
}

async function loadBounds(): Promise<DataBounds> {
  const [last] = await queryDuckDB<{ last_date: string }>(
    `SELECT CAST(MAX(date) AS VARCHAR) AS last_date FROM fact_sales_daily`,
  );
  const periods = await queryDuckDB<{
    business_year: number;
    business_period_number: number;
    business_period_label: string;
    start_date: string;
    end_date: string;
  }>(`
    SELECT CAST(business_year AS INTEGER) AS business_year,
           CAST(business_period_number AS INTEGER) AS business_period_number,
           ANY_VALUE(business_period_label) AS business_period_label,
           CAST(MIN(full_date) AS VARCHAR) AS start_date,
           CAST(MAX(full_date) AS VARCHAR) AS end_date
    FROM dim_date
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  const markets = await queryDuckDB<{ code: string; name: string }>(`
    SELECT market_code AS code, ANY_VALUE(market_name) AS name
    FROM dim_store GROUP BY market_code ORDER BY name
  `);

  const lastDataDate = last.last_date;
  const periodDates: DataBounds["periodDates"] = {};
  const maxPeriodByYear: Record<number, number> = {};
  for (const p of periods) {
    periodDates[`${p.business_year}-${p.business_period_number}`] = {
      start: p.start_date,
      end: p.end_date,
      label: p.business_period_label,
    };
    if (p.start_date <= lastDataDate) {
      maxPeriodByYear[p.business_year] = Math.max(maxPeriodByYear[p.business_year] ?? 0, p.business_period_number);
    }
  }
  const years = Object.keys(maxPeriodByYear).map(Number);

  return {
    lastDataDate,
    firstYear: Math.min(...years),
    latestYear: Math.max(...years),
    maxPeriodByYear,
    periodDates,
    markets,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Turns whatever is in the URL into a selection the data can answer.
 * Defaults to the latest year, periods 1 to the latest one traded, all
 * markets, i.e. year to date. Anything out of range is pulled back in
 * rather than producing an empty page. */
export function resolveFilters(raw: RawFilters, bounds: DataBounds): ResolvedFilters {
  const year =
    raw.year !== undefined && bounds.maxPeriodByYear[raw.year] !== undefined ? raw.year : bounds.latestYear;
  const maxPeriod = bounds.maxPeriodByYear[year];
  const periodTo = clamp(raw.to ?? maxPeriod, 1, maxPeriod);
  const periodFrom = clamp(raw.from ?? 1, 1, periodTo);
  const market = raw.market && bounds.markets.some((m) => m.code === raw.market) ? raw.market : null;

  const tyStart = bounds.periodDates[`${year}-${periodFrom}`].start;
  const periodEnd = bounds.periodDates[`${year}-${periodTo}`].end;
  const tyEnd = minDate(periodEnd, bounds.lastDataDate);

  return {
    year,
    periodFrom,
    periodTo,
    market,
    tyStart,
    tyEnd,
    lyStart: addDays(tyStart, -364),
    lyEnd: addDays(tyEnd, -364),
    hasLastYear: year > bounds.firstYear,
    days: daysBetweenInclusive(tyStart, tyEnd),
    lastDataDate: bounds.lastDataDate,
    isPartial: tyEnd < periodEnd,
  };
}