import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, periodsAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Stores page. Physical stores only (Retail and
// Concession): Online has no footfall, floor space or door to count.

const PHYSICAL = `s.channel <> 'Online'`;

export type StoreKpis = {
  footfallTy: number;
  footfallLy: number | null;
  conversionTy: number;
  conversionLy: number | null;
  atvTy: number;
  atvLy: number | null;
  iptTy: number;
  iptLy: number | null;
  salesPerSqFtTy: number;
  salesPerSqFtLy: number | null;
};

export type FunnelStep = { label: string; ty: number; ly: number | null };

export type StoresSummary = { kpis: StoreKpis; funnel: FunnelStep[] };

export async function fetchStoresSummary(f: ResolvedFilters): Promise<StoresSummary> {
  const [r] = await queryDuckDB<{
    ff_ty: number; ff_ly: number | null;
    tx_ty: number; tx_ly: number | null;
    units_ty: number; units_ly: number | null;
    multi_ty: number; multi_ly: number | null;
    sales_ty: number; sales_ly: number | null;
    sqft_ty: number; sqft_ly: number | null;
  }>(`
    WITH ff AS (
      SELECT
        SUM(x.footfall) FILTER (WHERE ${tyDates(f, "x.date")}) AS ff_ty,
        SUM(x.footfall) FILTER (WHERE ${lyDates(f, "x.date")}) AS ff_ly,
        SUM(x.transactions) FILTER (WHERE ${tyDates(f, "x.date")}) AS tx_ty,
        SUM(x.transactions) FILTER (WHERE ${lyDates(f, "x.date")}) AS tx_ly,
        SUM(x.units_sold) FILTER (WHERE ${tyDates(f, "x.date")}) AS units_ty,
        SUM(x.units_sold) FILTER (WHERE ${lyDates(f, "x.date")}) AS units_ly,
        SUM(x.multi_item_baskets) FILTER (WHERE ${tyDates(f, "x.date")}) AS multi_ty,
        SUM(x.multi_item_baskets) FILTER (WHERE ${lyDates(f, "x.date")}) AS multi_ly
      FROM fact_footfall_daily x
      JOIN dim_store s ON x.store_id = s.store_id
      WHERE ${PHYSICAL} ${marketAnd(f, "s")}
    ),
    sa AS (
      SELECT
        SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS sales_ty,
        SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS sales_ly
      FROM fact_sales_daily x
      JOIN dim_store s ON x.store_id = s.store_id
      WHERE ${PHYSICAL} ${marketAnd(f, "s")}
    ),
    -- Floor space of the stores that actually traded in each window, so a
    -- store that opened or closed between the two years doesn't distort
    -- sales per square foot.
    space AS (
      SELECT
        SUM(s.square_footage) FILTER (WHERE s.store_id IN (
          SELECT DISTINCT store_id FROM fact_footfall_daily x WHERE ${tyDates(f, "x.date")})) AS sqft_ty,
        SUM(s.square_footage) FILTER (WHERE s.store_id IN (
          SELECT DISTINCT store_id FROM fact_footfall_daily x WHERE ${lyDates(f, "x.date")})) AS sqft_ly
      FROM dim_store s
      WHERE ${PHYSICAL} ${marketAnd(f, "s")}
    )
    SELECT CAST(ff_ty AS DOUBLE) AS ff_ty, CAST(ff_ly AS DOUBLE) AS ff_ly,
           CAST(tx_ty AS DOUBLE) AS tx_ty, CAST(tx_ly AS DOUBLE) AS tx_ly,
           CAST(units_ty AS DOUBLE) AS units_ty, CAST(units_ly AS DOUBLE) AS units_ly,
           CAST(multi_ty AS DOUBLE) AS multi_ty, CAST(multi_ly AS DOUBLE) AS multi_ly,
           CAST(sales_ty AS DOUBLE) AS sales_ty, CAST(sales_ly AS DOUBLE) AS sales_ly,
           CAST(sqft_ty AS DOUBLE) AS sqft_ty, CAST(sqft_ly AS DOUBLE) AS sqft_ly
    FROM ff, sa, space
  `);

  const hasLy = f.hasLastYear && !!r.ff_ly;
  const annualise = 364 / f.days;
  const ratio = (a: number | null, b: number | null) => (a !== null && b ? a / b : null);

  return {
    kpis: {
      footfallTy: r.ff_ty ?? 0,
      footfallLy: hasLy ? r.ff_ly : null,
      conversionTy: ratio(r.tx_ty, r.ff_ty) ?? 0,
      conversionLy: hasLy ? ratio(r.tx_ly, r.ff_ly) : null,
      atvTy: ratio(r.sales_ty, r.tx_ty) ?? 0,
      atvLy: hasLy ? ratio(r.sales_ly, r.tx_ly) : null,
      iptTy: ratio(r.units_ty, r.tx_ty) ?? 0,
      iptLy: hasLy ? ratio(r.units_ly, r.tx_ly) : null,
      salesPerSqFtTy: (ratio(r.sales_ty, r.sqft_ty) ?? 0) * annualise,
      salesPerSqFtLy: hasLy ? (ratio(r.sales_ly, r.sqft_ly) ?? 0) * annualise : null,
    },
    funnel: [
      { label: "Visitors", ty: r.ff_ty ?? 0, ly: hasLy ? r.ff_ly : null },
      { label: "Bought something", ty: r.tx_ty ?? 0, ly: hasLy ? r.tx_ly : null },
      { label: "Bought 2+ items", ty: r.multi_ty ?? 0, ly: hasLy ? r.multi_ly : null },
    ],
  };
}

export type StoreRow = {
  storeId: string;
  storeName: string;
  market: string;
  storeType: string;
  channel: string;
  squareFootage: number;
  footfall: number;
  conversion: number;
  salesTy: number;
  salesLy: number | null;
  salesPerSqFt: number;
  /** From the store P&L for the selected periods. null if no finance rows. */
  netContributionPct: number | null;
};

/** One row per physical store that traded in the selection: the scatter
 * and the league table both read from this. */
export async function fetchStoreRows(f: ResolvedFilters): Promise<StoreRow[]> {
  const rows = await queryDuckDB<{
    store_id: string; store_name: string; market_name: string; store_type: string; channel: string;
    square_footage: number; footfall: number; transactions: number;
    sales_ty: number | null; sales_ly: number | null;
    fin_sales: number | null; fin_contribution: number | null;
  }>(`
    WITH ff AS (
      SELECT x.store_id, SUM(x.footfall) AS footfall, SUM(x.transactions) AS transactions
      FROM fact_footfall_daily x
      WHERE ${tyDates(f, "x.date")}
      GROUP BY 1
    ),
    sa AS (
      SELECT x.store_id,
             SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS sales_ty,
             SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS sales_ly
      FROM fact_sales_daily x
      WHERE ${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}
      GROUP BY 1
    ),
    fin AS (
      SELECT fi.store_id, SUM(fi.net_sales_gbp) AS fin_sales, SUM(fi.net_contribution_gbp) AS fin_contribution
      FROM fact_store_finance fi
      WHERE TRUE ${periodsAnd(f, "fi")}
      GROUP BY 1
    )
    SELECT s.store_id, s.store_name, s.market_name, s.store_type, s.channel,
           CAST(s.square_footage AS DOUBLE) AS square_footage,
           CAST(ff.footfall AS DOUBLE) AS footfall,
           CAST(ff.transactions AS DOUBLE) AS transactions,
           CAST(sa.sales_ty AS DOUBLE) AS sales_ty,
           CAST(sa.sales_ly AS DOUBLE) AS sales_ly,
           CAST(fin.fin_sales AS DOUBLE) AS fin_sales,
           CAST(fin.fin_contribution AS DOUBLE) AS fin_contribution
    FROM dim_store s
    JOIN ff ON ff.store_id = s.store_id
    LEFT JOIN sa ON sa.store_id = s.store_id
    LEFT JOIN fin ON fin.store_id = s.store_id
    WHERE ${PHYSICAL} ${marketAnd(f, "s")}
    ORDER BY sales_ty DESC NULLS LAST
  `);

  const annualise = 364 / f.days;
  return rows.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    market: r.market_name,
    storeType: r.store_type,
    channel: r.channel,
    squareFootage: r.square_footage,
    footfall: r.footfall,
    conversion: r.footfall ? r.transactions / r.footfall : 0,
    salesTy: r.sales_ty ?? 0,
    salesLy: f.hasLastYear && r.sales_ly ? r.sales_ly : null,
    salesPerSqFt: r.square_footage ? ((r.sales_ty ?? 0) / r.square_footage) * annualise : 0,
    netContributionPct: r.fin_sales ? (r.fin_contribution ?? 0) / r.fin_sales : null,
  }));
}

export type FootfallCell = { period: number; periodLabel: string; dow: number; dayName: string; avgFootfall: number };

/** Average footfall per trading day, by weekday and business period.
 * An average rather than a total, because a five-week period has more
 * Saturdays than a four-week one and would look busier for no reason. */
export async function fetchFootfallRhythm(f: ResolvedFilters): Promise<FootfallCell[]> {
  return queryDuckDB<FootfallCell>(`
    SELECT CAST(d.business_period_number AS INTEGER) AS period,
           ANY_VALUE(d.business_period_label) AS "periodLabel",
           CAST(d.day_of_week_num AS INTEGER) AS dow,
           ANY_VALUE(d.day_name) AS "dayName",
           CAST(SUM(x.footfall) / COUNT(DISTINCT x.date) AS DOUBLE) AS "avgFootfall"
    FROM fact_footfall_daily x
    JOIN dim_date d ON x.date = d.full_date
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE ${tyDates(f, "x.date")} AND ${PHYSICAL} ${marketAnd(f, "s")}
    GROUP BY 1, 3
    ORDER BY 1, 3
  `);
}