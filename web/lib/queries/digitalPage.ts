import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, periodsAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Digital page. The digital facts carry market_code
// directly, so the market filter applies to them without going through
// dim_store. Sales and traffic are separate tables that share date,
// market and device, which is what lets conversion be split by device
// honestly: one device's orders over the same device's sessions.

export type DigitalSummary = {
  salesTy: number;
  salesLy: number | null;
  targetToDate: number;
  sessionsTy: number;
  sessionsLy: number | null;
  conversionTy: number;
  conversionLy: number | null;
  aovTy: number;
  aovLy: number | null;
  pagesPerSessionTy: number;
  pagesPerSessionLy: number | null;
};

export async function fetchDigitalSummary(f: ResolvedFilters): Promise<DigitalSummary> {
  const [s] = await queryDuckDB<{
    sales_ty: number | null; sales_ly: number | null; orders_ty: number | null; orders_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(x.orders) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS orders_ty,
      CAST(SUM(x.orders) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS orders_ly
    FROM fact_digital_sales x
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
  `);
  const [t] = await queryDuckDB<{
    sessions_ty: number | null; sessions_ly: number | null; pages_ty: number | null; pages_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.sessions) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sessions_ty,
      CAST(SUM(x.sessions) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sessions_ly,
      CAST(SUM(x.page_views) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS pages_ty,
      CAST(SUM(x.page_views) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS pages_ly
    FROM fact_digital_traffic x
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
  `);
  // Digital targets by period, with the period still trading phased by how
  // much of last year's same period had sold by the same day: the same
  // approach as the Sales page.
  const targets = await queryDuckDB<{ target: number; period_end: string; ly_elapsed: number | null; ly_full: number | null; days_elapsed: number; days_total: number }>(`
    WITH per AS (
      SELECT business_period_number AS p, MIN(full_date) AS s, MAX(full_date) AS e
      FROM dim_date WHERE business_year = ${f.year} AND business_period_number BETWEEN ${f.periodFrom} AND ${f.periodTo}
      GROUP BY 1
    ),
    tg AS (
      SELECT t.business_period_number AS p, SUM(t.target_digital_net_sales_gbp) AS target
      FROM fact_digital_targets t WHERE TRUE ${periodsAnd(f, "t")} ${marketAnd(f, "t")}
      GROUP BY 1
    ),
    ly AS (
      SELECT per.p, SUM(x.net_sales_gbp) FILTER (WHERE x.date <= DATE '${f.lyEnd}') AS ly_elapsed, SUM(x.net_sales_gbp) AS ly_full
      FROM per JOIN fact_digital_sales x ON x.date BETWEEN per.s - 364 AND per.e - 364
      WHERE TRUE ${marketAnd(f, "x")}
      GROUP BY 1
    )
    SELECT CAST(COALESCE(tg.target, 0) AS DOUBLE) AS target, CAST(per.e AS VARCHAR) AS period_end,
           CAST(ly.ly_elapsed AS DOUBLE) AS ly_elapsed, CAST(ly.ly_full AS DOUBLE) AS ly_full,
           CAST(LEAST(per.e, DATE '${f.tyEnd}') - per.s + 1 AS INTEGER) AS days_elapsed,
           CAST(per.e - per.s + 1 AS INTEGER) AS days_total
    FROM per LEFT JOIN tg ON tg.p = per.p LEFT JOIN ly ON ly.p = per.p
  `);
  const targetToDate = targets.reduce((sum, r) => {
    if (r.period_end <= f.tyEnd) return sum + r.target;
    const share = f.hasLastYear && r.ly_full && r.ly_elapsed !== null ? r.ly_elapsed / r.ly_full : r.days_elapsed / r.days_total;
    return sum + r.target * share;
  }, 0);

  const hasLy = f.hasLastYear && !!s.sales_ly;
  const ratio = (a: number | null, b: number | null) => (a !== null && b ? a / b : 0);
  return {
    salesTy: s.sales_ty ?? 0,
    salesLy: hasLy ? s.sales_ly : null,
    targetToDate,
    sessionsTy: t.sessions_ty ?? 0,
    sessionsLy: hasLy ? t.sessions_ly : null,
    conversionTy: ratio(s.orders_ty, t.sessions_ty),
    conversionLy: hasLy ? ratio(s.orders_ly, t.sessions_ly) : null,
    aovTy: ratio(s.sales_ty, s.orders_ty),
    aovLy: hasLy ? ratio(s.sales_ly, s.orders_ly) : null,
    pagesPerSessionTy: ratio(t.pages_ty, t.sessions_ty),
    pagesPerSessionLy: hasLy ? ratio(t.pages_ly, t.sessions_ly) : null,
  };
}

export type WeeklyDeviceSessions = { week: number; device: string; sessions: number };

export async function fetchWeeklySessionsByDevice(f: ResolvedFilters): Promise<WeeklyDeviceSessions[]> {
  return queryDuckDB<WeeklyDeviceSessions>(`
    SELECT CAST(d.business_week_number AS INTEGER) AS week, x.device_type AS device, CAST(SUM(x.sessions) AS DOUBLE) AS sessions
    FROM fact_digital_traffic x
    JOIN dim_date d ON d.full_date = x.date
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "x")}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
}

export type DeviceRow = {
  device: string;
  orders: number;
  sessions: number;
  sales: number;
  conversion: number;
  conversionLy: number | null;
};

/** Orders, sessions and conversion per device, joined on device so each
 * device's conversion is its own orders over its own sessions. */
export async function fetchDeviceConversion(f: ResolvedFilters): Promise<DeviceRow[]> {
  const rows = await queryDuckDB<{
    device: string; orders: number; orders_ly: number | null; sales: number; sessions: number; sessions_ly: number | null;
  }>(`
    WITH s AS (
      SELECT device_type,
             SUM(orders) FILTER (WHERE ${tyDates(f, "x.date")}) AS orders,
             SUM(orders) FILTER (WHERE ${lyDates(f, "x.date")}) AS orders_ly,
             SUM(net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS sales
      FROM fact_digital_sales x
      WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
      GROUP BY 1
    ),
    t AS (
      SELECT device_type,
             SUM(sessions) FILTER (WHERE ${tyDates(f, "x.date")}) AS sessions,
             SUM(sessions) FILTER (WHERE ${lyDates(f, "x.date")}) AS sessions_ly
      FROM fact_digital_traffic x
      WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
      GROUP BY 1
    )
    SELECT t.device_type AS device, CAST(COALESCE(s.orders, 0) AS DOUBLE) AS orders, CAST(s.orders_ly AS DOUBLE) AS orders_ly,
           CAST(COALESCE(s.sales, 0) AS DOUBLE) AS sales, CAST(COALESCE(t.sessions, 0) AS DOUBLE) AS sessions,
           CAST(t.sessions_ly AS DOUBLE) AS sessions_ly
    FROM t LEFT JOIN s ON s.device_type = t.device_type
    ORDER BY sessions DESC
  `);
  return rows.map((r) => ({
    device: r.device,
    orders: r.orders,
    sessions: r.sessions,
    sales: r.sales,
    conversion: r.sessions ? r.orders / r.sessions : 0,
    conversionLy: f.hasLastYear && r.sessions_ly ? (r.orders_ly ?? 0) / r.sessions_ly : null,
  }));
}

export type MarketDeviceCell = { market: string; device: string; conversion: number; sessions: number };

export async function fetchMarketDeviceConversion(f: ResolvedFilters): Promise<MarketDeviceCell[]> {
  return queryDuckDB<MarketDeviceCell>(`
    WITH markets AS (SELECT market_code, ANY_VALUE(market_name) AS market_name FROM dim_store GROUP BY 1),
    s AS (
      SELECT market_code, device_type, SUM(orders) AS orders FROM fact_digital_sales x
      WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "x")} GROUP BY 1, 2
    ),
    t AS (
      SELECT market_code, device_type, SUM(sessions) AS sessions FROM fact_digital_traffic x
      WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "x")} GROUP BY 1, 2
    )
    SELECT m.market_name AS market, t.device_type AS device,
           CAST(COALESCE(s.orders, 0) / NULLIF(t.sessions, 0) AS DOUBLE) AS conversion,
           CAST(t.sessions AS DOUBLE) AS sessions
    FROM t
    JOIN markets m ON m.market_code = t.market_code
    LEFT JOIN s ON s.market_code = t.market_code AND s.device_type = t.device_type
    WHERE t.sessions > 0
  `);
}

export type BrowserRow = { browser: string; sessions: number; share: number; pagesPerSession: number };

export async function fetchBrowsers(f: ResolvedFilters): Promise<BrowserRow[]> {
  const rows = await queryDuckDB<{ browser: string; sessions: number; pages: number }>(`
    SELECT x.browser, CAST(SUM(x.sessions) AS DOUBLE) AS sessions, CAST(SUM(x.page_views) AS DOUBLE) AS pages
    FROM fact_digital_traffic x
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "x")}
    GROUP BY 1
    ORDER BY sessions DESC
  `);
  const total = rows.reduce((a, r) => a + r.sessions, 0);
  return rows.map((r) => ({
    browser: r.browser,
    sessions: r.sessions,
    share: total ? r.sessions / total : 0,
    pagesPerSession: r.sessions ? r.pages / r.sessions : 0,
  }));
}