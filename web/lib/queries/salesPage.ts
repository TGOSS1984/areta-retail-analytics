import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { addDays } from "@/lib/filters/dates";
import { lyDates, marketAnd, periodsAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Sales page. Every one takes the resolved global
// filters, so "this year" is always the selected periods up to the last
// day of data, "last year" is always the same days 364 days earlier, and
// the market filter applies through dim_store.

export type SalesPeriod = {
  period: number;
  label: string;
  salesTy: number;
  /** Like-for-like: only the days of last year that match the days traded
   * so far this year, so a part-traded period isn't set against a full one. */
  salesLy: number | null;
  targetFull: number;
  /** The period target phased to the days traded. A complete period gets
   * all of it; the period still trading gets the share of it that last
   * year had sold by the same day, which respects the weekly and seasonal
   * shape instead of assuming every day is equal. Same idea as the
   * Any-Grain targets in the Power BI model. */
  targetToDate: number;
  isPartial: boolean;
};

export type SalesKpis = {
  salesTy: number;
  salesLy: number | null;
  unitsTy: number;
  unitsLy: number | null;
  marginTy: number;
  marginLy: number | null;
  onlineShareTy: number;
  onlineShareLy: number | null;
  targetToDate: number;
};

export type SalesPageData = { kpis: SalesKpis; periods: SalesPeriod[] };

export async function fetchSalesPage(f: ResolvedFilters): Promise<SalesPageData> {
  const periodRows = await queryDuckDB<{
    period: number;
    label: string;
    period_end: string;
    sales_ty: number | null;
    ly_elapsed: number | null;
    ly_full: number | null;
    target: number | null;
    days_elapsed: number;
    days_total: number;
  }>(`
    WITH per AS (
      SELECT business_period_number AS p,
             ANY_VALUE(business_period_label) AS label,
             MIN(full_date) AS s,
             MAX(full_date) AS e
      FROM dim_date
      WHERE business_year = ${f.year}
        AND business_period_number BETWEEN ${f.periodFrom} AND ${f.periodTo}
      GROUP BY 1
    ),
    ty AS (
      SELECT d.business_period_number AS p, SUM(x.net_sales_gbp) AS sales
      FROM fact_sales_daily x
      JOIN dim_date d ON x.date = d.full_date
      JOIN dim_store s ON x.store_id = s.store_id
      WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "s")}
      GROUP BY 1
    ),
    ly AS (
      SELECT per.p,
             SUM(x.net_sales_gbp) FILTER (WHERE x.date <= DATE '${f.lyEnd}') AS ly_elapsed,
             SUM(x.net_sales_gbp) AS ly_full
      FROM per
      JOIN fact_sales_daily x ON x.date BETWEEN per.s - 364 AND per.e - 364
      JOIN dim_store s ON x.store_id = s.store_id
      WHERE TRUE ${marketAnd(f, "s")}
      GROUP BY 1
    ),
    tg AS (
      SELECT t.business_period_number AS p, SUM(t.target_net_sales_gbp) AS target
      FROM fact_targets t
      JOIN dim_store s ON t.store_id = s.store_id
      WHERE TRUE ${periodsAnd(f, "t")} ${marketAnd(f, "s")}
      GROUP BY 1
    )
    SELECT CAST(per.p AS INTEGER) AS period,
           per.label,
           CAST(per.e AS VARCHAR) AS period_end,
           CAST(ty.sales AS DOUBLE) AS sales_ty,
           CAST(ly.ly_elapsed AS DOUBLE) AS ly_elapsed,
           CAST(ly.ly_full AS DOUBLE) AS ly_full,
           CAST(tg.target AS DOUBLE) AS target,
           CAST(LEAST(per.e, DATE '${f.tyEnd}') - per.s + 1 AS INTEGER) AS days_elapsed,
           CAST(per.e - per.s + 1 AS INTEGER) AS days_total
    FROM per
    LEFT JOIN ty ON ty.p = per.p
    LEFT JOIN ly ON ly.p = per.p
    LEFT JOIN tg ON tg.p = per.p
    ORDER BY per.p
  `);

  const periods: SalesPeriod[] = periodRows.map((r) => {
    const isPartial = r.period_end > f.tyEnd;
    const target = r.target ?? 0;
    let share = 1;
    if (isPartial) {
      share =
        f.hasLastYear && r.ly_full && r.ly_elapsed !== null
          ? r.ly_elapsed / r.ly_full
          : r.days_elapsed / r.days_total;
    }
    return {
      period: r.period,
      label: r.label,
      salesTy: r.sales_ty ?? 0,
      salesLy: f.hasLastYear ? r.ly_elapsed ?? 0 : null,
      targetFull: target,
      targetToDate: target * share,
      isPartial,
    };
  });

  const [k] = await queryDuckDB<{
    sales_ty: number;
    sales_ly: number | null;
    units_ty: number;
    units_ly: number | null;
    cost_ty: number;
    cost_ly: number | null;
    online_ty: number;
    online_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(x.quantity) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS units_ty,
      CAST(SUM(x.quantity) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS units_ly,
      CAST(SUM(x.cost_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS cost_ty,
      CAST(SUM(x.cost_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS cost_ly,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")} AND s.channel = 'Online') AS DOUBLE) AS online_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")} AND s.channel = 'Online') AS DOUBLE) AS online_ly
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "s")}
  `);

  const ly = f.hasLastYear && k.sales_ly ? k : null;
  return {
    kpis: {
      salesTy: k.sales_ty ?? 0,
      salesLy: ly ? ly.sales_ly : null,
      unitsTy: k.units_ty ?? 0,
      unitsLy: ly ? ly.units_ly : null,
      marginTy: k.sales_ty ? 1 - k.cost_ty / k.sales_ty : 0,
      marginLy: ly && ly.sales_ly ? 1 - (ly.cost_ly ?? 0) / ly.sales_ly : null,
      onlineShareTy: k.sales_ty ? (k.online_ty ?? 0) / k.sales_ty : 0,
      onlineShareLy: ly && ly.sales_ly ? (ly.online_ly ?? 0) / ly.sales_ly : null,
      targetToDate: periods.reduce((sum, p) => sum + p.targetToDate, 0),
    },
    periods,
  };
}

export type WeeklySales = { week: number; ty: number | null; ly: number | null };

/** Business-week totals for the selection and the same weeks last year.
 * Business years are 364 days, so week N last year is exactly the days
 * 364 days before week N this year, and a part-traded current week is
 * set against the matching part of last year's. */
export async function fetchWeeklySales(f: ResolvedFilters): Promise<WeeklySales[]> {
  const rows = await queryDuckDB<{ week: number; ty: number | null; ly: number | null }>(`
    SELECT CAST(d.business_week_number AS INTEGER) AS week,
           CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS ty,
           CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS ly
    FROM fact_sales_daily x
    JOIN dim_date d ON x.date = d.full_date
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "s")}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => ({ week: r.week, ty: r.ty, ly: f.hasLastYear ? r.ly : null }));
}

export type DailySales = { date: string; ty: number; ly: number | null };

/** Every trading day in the selection, with the same weekday last year
 * alongside for the tooltip. */
export async function fetchDailySales(f: ResolvedFilters): Promise<DailySales[]> {
  const rows = await queryDuckDB<{ date: string; sales: number }>(`
    SELECT CAST(x.date AS VARCHAR) AS date, CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "s")}
    GROUP BY 1
    ORDER BY 1
  `);
  const byDate = new Map(rows.map((r) => [r.date, r.sales]));
  return rows
    .filter((r) => r.date >= f.tyStart && r.date <= f.tyEnd)
    .map((r) => ({
      date: r.date,
      ty: r.sales,
      ly: f.hasLastYear ? byDate.get(addDays(r.date, -364)) ?? null : null,
    }));
}

export type BridgeStep = { label: string; ty: number; ly: number };

export type SalesBridge = { dimension: "market" | "channel"; steps: BridgeStep[] };

/** Last year to this year, one step per market. With a single market
 * selected, a bridge across markets would be one bar, so it switches to
 * channels instead. */
export async function fetchSalesBridge(f: ResolvedFilters): Promise<SalesBridge> {
  const dimension = f.market ? "channel" : "market";
  const column = dimension === "market" ? "s.market_name" : "s.channel";
  const rows = await queryDuckDB<{ label: string; ty: number | null; ly: number | null }>(`
    SELECT ${column} AS label,
           CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS ty,
           CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS ly
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "s")}
    GROUP BY 1
  `);
  const steps = rows
    .map((r) => ({ label: r.label, ty: r.ty ?? 0, ly: r.ly ?? 0 }))
    .sort((a, b) => b.ty - b.ly - (a.ty - a.ly));
  return { dimension, steps };
}