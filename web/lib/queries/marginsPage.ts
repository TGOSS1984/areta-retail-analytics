import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, periodsAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Margins page. Product margin comes from the sales mix
// export (so it covers every channel); the P&L and store contribution come
// from the store finance table, which only has Retail and Concession
// stores, because Online carries no store running costs to bridge.

export const DISCOUNT_BAND_ORDER = ["Full Price", "Multi-buy", "Up to 30% off", "31-50% off", "51-70% off", "70%+ off"];

export type PnL = {
  turnover: number;
  cogs: number;
  grossProfit: number;
  rent: number;
  staff: number;
  utilities: number;
  marketing: number;
  headOffice: number;
  netContribution: number;
};

export type MarginsSummary = {
  marginTy: number;
  marginLy: number | null;
  grossProfitTy: number;
  grossProfitLy: number | null;
  fullPriceMixTy: number;
  fullPriceMixLy: number | null;
  netContributionPctTy: number;
  netContributionPctLy: number | null;
  costRatioTy: number;
  costRatioLy: number | null;
  pnl: PnL;
};

function lyPeriods(f: ResolvedFilters, alias: string): string {
  return `AND ${alias}.business_year = ${f.year - 1} AND ${alias}.business_period_number BETWEEN ${f.periodFrom} AND ${f.periodTo}`;
}

export async function fetchMarginsSummary(f: ResolvedFilters): Promise<MarginsSummary> {
  const [m] = await queryDuckDB<{
    sales_ty: number; cost_ty: number; fp_ty: number;
    sales_ly: number | null; cost_ly: number | null; fp_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(m.cost_gbp) FILTER (WHERE ${tyDates(f, "m.date")}) AS DOUBLE) AS cost_ty,
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")} AND m.discount_band = 'Full Price') AS DOUBLE) AS fp_ty,
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(m.cost_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS cost_ly,
      CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")} AND m.discount_band = 'Full Price') AS DOUBLE) AS fp_ly
    FROM fact_sales_mix_daily m
    WHERE (${tyDates(f, "m.date")} OR ${lyDates(f, "m.date")}) ${marketAnd(f, "m")}
  `);

  const pnlSql = (periods: string) => `
    SELECT CAST(SUM(fi.net_sales_gbp) AS DOUBLE) AS turnover, CAST(SUM(fi.cogs_gbp) AS DOUBLE) AS cogs,
           CAST(SUM(fi.gross_profit_gbp) AS DOUBLE) AS gross_profit, CAST(SUM(fi.rent_gbp) AS DOUBLE) AS rent,
           CAST(SUM(fi.staff_gbp) AS DOUBLE) AS staff, CAST(SUM(fi.utilities_gbp) AS DOUBLE) AS utilities,
           CAST(SUM(fi.marketing_gbp) AS DOUBLE) AS marketing, CAST(SUM(fi.head_office_gbp) AS DOUBLE) AS head_office,
           CAST(SUM(fi.net_contribution_gbp) AS DOUBLE) AS net_contribution
    FROM fact_store_finance fi
    JOIN dim_store s ON s.store_id = fi.store_id
    WHERE TRUE ${periods} ${marketAnd(f, "s")}`;
  type Row = {
    turnover: number | null; cogs: number; gross_profit: number; rent: number; staff: number;
    utilities: number; marketing: number; head_office: number; net_contribution: number;
  };
  const [ty] = await queryDuckDB<Row>(pnlSql(periodsAnd(f, "fi")));
  const [ly] = f.hasLastYear ? await queryDuckDB<Row>(pnlSql(lyPeriods(f, "fi"))) : [null];

  const hasLy = f.hasLastYear && !!m.sales_ly;
  const margin = (s: number | null, c: number | null) => (s ? 1 - (c ?? 0) / s : 0);
  const opex = (r: Row) => r.rent + r.staff + r.utilities + r.marketing + r.head_office;

  return {
    marginTy: margin(m.sales_ty, m.cost_ty),
    marginLy: hasLy ? margin(m.sales_ly, m.cost_ly) : null,
    grossProfitTy: (m.sales_ty ?? 0) - (m.cost_ty ?? 0),
    grossProfitLy: hasLy ? (m.sales_ly ?? 0) - (m.cost_ly ?? 0) : null,
    fullPriceMixTy: m.sales_ty ? (m.fp_ty ?? 0) / m.sales_ty : 0,
    fullPriceMixLy: hasLy && m.sales_ly ? (m.fp_ly ?? 0) / m.sales_ly : null,
    netContributionPctTy: ty.turnover ? ty.net_contribution / ty.turnover : 0,
    netContributionPctLy: ly && ly.turnover ? ly.net_contribution / ly.turnover : null,
    costRatioTy: ty.turnover ? opex(ty) / ty.turnover : 0,
    costRatioLy: ly && ly.turnover ? opex(ly) / ly.turnover : null,
    pnl: {
      turnover: ty.turnover ?? 0,
      cogs: ty.cogs ?? 0,
      grossProfit: ty.gross_profit ?? 0,
      rent: ty.rent ?? 0,
      staff: ty.staff ?? 0,
      utilities: ty.utilities ?? 0,
      marketing: ty.marketing ?? 0,
      headOffice: ty.head_office ?? 0,
      netContribution: ty.net_contribution ?? 0,
    },
  };
}

export type BandRow = { band: string; sales: number; margin: number; units: number };

/** Sales and margin by discount band, in band order rather than by size,
 * so the chart reads as "deeper discount, left to right". */
export async function fetchDiscountBands(f: ResolvedFilters): Promise<BandRow[]> {
  const rows = await queryDuckDB<{ band: string; sales: number; cost: number; units: number }>(`
    SELECT m.discount_band AS band, CAST(SUM(m.net_sales_gbp) AS DOUBLE) AS sales,
           CAST(SUM(m.cost_gbp) AS DOUBLE) AS cost, CAST(SUM(m.quantity) AS DOUBLE) AS units
    FROM fact_sales_mix_daily m
    WHERE ${tyDates(f, "m.date")} ${marketAnd(f, "m")}
    GROUP BY 1
  `);
  return rows
    .map((r) => ({ band: r.band, sales: r.sales, margin: r.sales ? 1 - r.cost / r.sales : 0, units: r.units }))
    .sort((a, b) => DISCOUNT_BAND_ORDER.indexOf(a.band) - DISCOUNT_BAND_ORDER.indexOf(b.band));
}

export type StoreContribution = { storeName: string; storeType: string; market: string; pct: number };

/** Net contribution % for every physical store over the selected
 * periods, for the box plot. */
export async function fetchStoreContribution(f: ResolvedFilters): Promise<StoreContribution[]> {
  return queryDuckDB<StoreContribution>(`
    SELECT s.store_name AS "storeName", s.store_type AS "storeType", s.market_name AS market,
           CAST(SUM(fi.net_contribution_gbp) / SUM(fi.net_sales_gbp) AS DOUBLE) AS pct
    FROM fact_store_finance fi
    JOIN dim_store s ON s.store_id = fi.store_id
    WHERE TRUE ${periodsAnd(f, "fi")} ${marketAnd(f, "s")}
    GROUP BY 1, 2, 3
    HAVING SUM(fi.net_sales_gbp) > 0
  `);
}

export type MarginCell = { productGroup: string; period: number; sales: number; margin: number };

/** Product group x business period margin, for the matrix. */
export async function fetchMarginMatrix(f: ResolvedFilters): Promise<MarginCell[]> {
  return queryDuckDB<MarginCell>(`
    SELECT m.product_group AS "productGroup", CAST(d.business_period_number AS INTEGER) AS period,
           CAST(SUM(m.net_sales_gbp) AS DOUBLE) AS sales,
           CAST(1 - SUM(m.cost_gbp) / NULLIF(SUM(m.net_sales_gbp), 0) AS DOUBLE) AS margin
    FROM fact_sales_mix_daily m
    JOIN dim_date d ON d.full_date = m.date
    WHERE ${tyDates(f, "m.date")} ${marketAnd(f, "m")}
    GROUP BY 1, 2
    HAVING SUM(m.net_sales_gbp) > 0
  `);
}