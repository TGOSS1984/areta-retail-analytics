import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, tyDates } from "@/lib/filters/sql";

export type SalesSummary = {
  totalSalesGbp: number;
  totalUnits: number;
  grossMarginPct: number;
  retailSalesGbp: number;
  concessionSalesGbp: number;
  onlineSalesGbp: number;
  /** null when the selection is the first year of data. */
  deltaVsLastYear: {
    totalSalesPct: number;
    totalUnitsPct: number;
    grossMarginPp: number;
    retailSalesPct: number;
    concessionSalesPct: number;
    onlineSalesPct: number;
  } | null;
};

function pctDelta(current: number, prior: number): number {
  return prior ? ((current - prior) / prior) * 100 : 0;
}

/**
 * The Overview KPI cards for the selected periods and market, against the
 * same days last year. Like-for-like by date rather than by period
 * number: the period still trading is compared with the matching days of
 * last year's period, not all of it. The first version compared a part
 * year with a full one and showed a -48% "decline" that was only fewer
 * months elapsed.
 */
export async function fetchSalesSummary(f: ResolvedFilters): Promise<SalesSummary> {
  const [r] = await queryDuckDB<{
    sales_ty: number; sales_ly: number | null;
    units_ty: number; units_ly: number | null;
    cost_ty: number; cost_ly: number | null;
    retail_ty: number; retail_ly: number | null;
    concession_ty: number; concession_ly: number | null;
    online_ty: number; online_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(x.quantity) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS units_ty,
      CAST(SUM(x.quantity) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS units_ly,
      CAST(SUM(x.cost_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS cost_ty,
      CAST(SUM(x.cost_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS cost_ly,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")} AND s.channel = 'Retail') AS DOUBLE) AS retail_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")} AND s.channel = 'Retail') AS DOUBLE) AS retail_ly,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")} AND s.channel = 'Concession') AS DOUBLE) AS concession_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")} AND s.channel = 'Concession') AS DOUBLE) AS concession_ly,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")} AND s.channel = 'Online') AS DOUBLE) AS online_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")} AND s.channel = 'Online') AS DOUBLE) AS online_ly
    FROM fact_sales_daily x
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE (${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}) ${marketAnd(f, "s")}
  `);

  const margin = (sales: number | null, cost: number | null) => (sales ? 1 - (cost ?? 0) / sales : 0);
  const hasLy = f.hasLastYear && !!r.sales_ly;

  return {
    totalSalesGbp: r.sales_ty ?? 0,
    totalUnits: r.units_ty ?? 0,
    grossMarginPct: margin(r.sales_ty, r.cost_ty) * 100,
    retailSalesGbp: r.retail_ty ?? 0,
    concessionSalesGbp: r.concession_ty ?? 0,
    onlineSalesGbp: r.online_ty ?? 0,
    deltaVsLastYear: hasLy
      ? {
          totalSalesPct: pctDelta(r.sales_ty ?? 0, r.sales_ly ?? 0),
          totalUnitsPct: pctDelta(r.units_ty ?? 0, r.units_ly ?? 0),
          grossMarginPp: (margin(r.sales_ty, r.cost_ty) - margin(r.sales_ly, r.cost_ly)) * 100,
          retailSalesPct: pctDelta(r.retail_ty ?? 0, r.retail_ly ?? 0),
          concessionSalesPct: pctDelta(r.concession_ty ?? 0, r.concession_ly ?? 0),
          onlineSalesPct: pctDelta(r.online_ty ?? 0, r.online_ly ?? 0),
        }
      : null,
  };
}