import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Customers page. There are no customer records in
// this data, so the page is about shopping behaviour instead: one invoice
// is one basket, one trip. Baskets come from the basket export (returns
// excluded, since a refund isn't a shopping trip); return rates come from
// the returns columns on the sales mix export.

export type BasketSummary = {
  basketsTy: number;
  basketsLy: number | null;
  atvTy: number;
  atvLy: number | null;
  itemsPerBasketTy: number;
  itemsPerBasketLy: number | null;
  multiItemShareTy: number;
  multiItemShareLy: number | null;
  returnRateTy: number;
  returnRateLy: number | null;
};

export async function fetchBasketSummary(f: ResolvedFilters): Promise<BasketSummary> {
  const [b] = await queryDuckDB<{
    baskets_ty: number | null; baskets_ly: number | null; units_ty: number | null; units_ly: number | null;
    sales_ty: number | null; sales_ly: number | null; multi_ty: number | null; multi_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.baskets) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS baskets_ty,
      CAST(SUM(x.baskets) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS baskets_ly,
      CAST(SUM(x.units) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS units_ty,
      CAST(SUM(x.units) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS units_ly,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(x.baskets) FILTER (WHERE ${tyDates(f, "x.date")} AND x.basket_size >= 2) AS DOUBLE) AS multi_ty,
      CAST(SUM(x.baskets) FILTER (WHERE ${lyDates(f, "x.date")} AND x.basket_size >= 2) AS DOUBLE) AS multi_ly
    FROM fact_baskets_daily x
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
  `);
  const [r] = await queryDuckDB<{ net_ty: number | null; ret_ty: number | null; net_ly: number | null; ret_ly: number | null }>(`
    SELECT
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS net_ty,
      CAST(SUM(m.returned_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS ret_ty,
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS net_ly,
      CAST(SUM(m.returned_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS ret_ly
    FROM fact_sales_mix_daily m
    WHERE (${tyDates(f, "m.date")} OR ${lyDates(f, "m.date")}) ${marketAnd(f, "m")}
  `);
  const hasLy = f.hasLastYear && !!b.baskets_ly;
  const div = (a: number | null, c: number | null) => (a !== null && c ? a / c : 0);
  // Return rate on gross sales: what came back, over what went out before
  // anything came back.
  const returnRate = (net: number | null, ret: number | null) => div(ret, (net ?? 0) + (ret ?? 0));
  return {
    basketsTy: b.baskets_ty ?? 0,
    basketsLy: hasLy ? b.baskets_ly : null,
    atvTy: div(b.sales_ty, b.baskets_ty),
    atvLy: hasLy ? div(b.sales_ly, b.baskets_ly) : null,
    itemsPerBasketTy: div(b.units_ty, b.baskets_ty),
    itemsPerBasketLy: hasLy ? div(b.units_ly, b.baskets_ly) : null,
    multiItemShareTy: div(b.multi_ty, b.baskets_ty),
    multiItemShareLy: hasLy ? div(b.multi_ly, b.baskets_ly) : null,
    returnRateTy: returnRate(r.net_ty, r.ret_ty),
    returnRateLy: hasLy ? returnRate(r.net_ly, r.ret_ly) : null,
  };
}

export type BasketSizeRow = { size: number; baskets: number; sales: number; basketsLy: number | null };

export async function fetchBasketSizes(f: ResolvedFilters): Promise<BasketSizeRow[]> {
  const rows = await queryDuckDB<BasketSizeRow>(`
    SELECT CAST(x.basket_size AS INTEGER) AS size,
           CAST(COALESCE(SUM(x.baskets) FILTER (WHERE ${tyDates(f, "x.date")}), 0) AS DOUBLE) AS baskets,
           CAST(COALESCE(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}), 0) AS DOUBLE) AS sales,
           CAST(SUM(x.baskets) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS "basketsLy"
    FROM fact_baskets_daily x
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
    GROUP BY 1
    ORDER BY 1
  `);
  return f.hasLastYear ? rows : rows.map((r) => ({ ...r, basketsLy: null }));
}

export type AtvCell = { market: string; channel: string; atv: number; baskets: number };

export async function fetchAtvByMarketChannel(f: ResolvedFilters): Promise<AtvCell[]> {
  return queryDuckDB<AtvCell>(`
    WITH markets AS (SELECT market_code, ANY_VALUE(market_name) AS market_name FROM dim_store GROUP BY 1)
    SELECT m.market_name AS market, x.channel,
           CAST(SUM(x.net_sales_gbp) / SUM(x.baskets) AS DOUBLE) AS atv,
           CAST(SUM(x.baskets) AS DOUBLE) AS baskets
    FROM fact_baskets_daily x
    JOIN markets m ON m.market_code = x.market_code
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "x")}
    GROUP BY 1, 2
    HAVING SUM(x.baskets) > 0
  `);
}

export type WeeklyMultiItem = { week: number; ty: number | null; ly: number | null };

/** Share of baskets with two or more items, by business week, this year
 * and the same weeks last year. */
export async function fetchMultiItemTrend(f: ResolvedFilters): Promise<WeeklyMultiItem[]> {
  const rows = await queryDuckDB<{ week: number; b_ty: number | null; m_ty: number | null; b_ly: number | null; m_ly: number | null }>(`
    SELECT CAST(d.business_week_number AS INTEGER) AS week,
           SUM(x.baskets) FILTER (WHERE ${tyDates(f, "x.date")}) AS b_ty,
           SUM(x.baskets) FILTER (WHERE ${tyDates(f, "x.date")} AND x.basket_size >= 2) AS m_ty,
           SUM(x.baskets) FILTER (WHERE ${lyDates(f, "x.date")}) AS b_ly,
           SUM(x.baskets) FILTER (WHERE ${lyDates(f, "x.date")} AND x.basket_size >= 2) AS m_ly
    FROM fact_baskets_daily x
    JOIN dim_date d ON d.full_date = x.date
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "x")}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => ({
    week: r.week,
    ty: r.b_ty ? Number(r.m_ty ?? 0) / Number(r.b_ty) : null,
    ly: f.hasLastYear && r.b_ly ? Number(r.m_ly ?? 0) / Number(r.b_ly) : null,
  }));
}

export type ReturnsRow = { majorGroup: string; rate: number; rateLy: number | null; returned: number };

export async function fetchReturnsByGroup(f: ResolvedFilters): Promise<ReturnsRow[]> {
  const rows = await queryDuckDB<{ grp: string; net_ty: number; ret_ty: number; net_ly: number | null; ret_ly: number | null }>(`
    SELECT m.major_product_group AS grp,
           CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS net_ty,
           CAST(SUM(m.returned_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS ret_ty,
           CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS net_ly,
           CAST(SUM(m.returned_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS ret_ly
    FROM fact_sales_mix_daily m
    WHERE (${tyDates(f, "m.date")} OR ${lyDates(f, "m.date")}) ${marketAnd(f, "m")}
    GROUP BY 1
  `);
  const rate = (net: number | null, ret: number | null) => ((net ?? 0) + (ret ?? 0) ? (ret ?? 0) / ((net ?? 0) + (ret ?? 0)) : 0);
  return rows
    .map((r) => ({
      majorGroup: r.grp,
      rate: rate(r.net_ty, r.ret_ty),
      rateLy: f.hasLastYear && r.net_ly ? rate(r.net_ly, r.ret_ly) : null,
      returned: r.ret_ty ?? 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}