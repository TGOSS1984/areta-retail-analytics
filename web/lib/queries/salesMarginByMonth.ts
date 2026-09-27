import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { marketAnd, tyDates } from "@/lib/filters/sql";

export type SalesMarginPoint = {
  period: number;
  label: string;
  salesGbp: number;
  marginPct: number;
  /** The period still trading: shown, but marked, so a part-period total
   * isn't read as a slump. */
  isPartial: boolean;
};

/**
 * Sales (bars) and gross margin % (line) by business period, for the
 * selected year, periods and market.
 *
 * This used to be calendar months with its own year picker. Once the
 * global filters arrived that didn't fit: the filter is in business
 * periods (P01 starts in March), so a calendar chart couldn't follow it,
 * and a second year picker on one card contradicted the one at the top.
 * Business periods also line up with every other chart in the app.
 * The period still trading used to be dropped entirely; now it's kept and
 * marked, the same way as on the Sales page.
 */
export async function fetchSalesMarginByPeriod(f: ResolvedFilters): Promise<SalesMarginPoint[]> {
  const rows = await queryDuckDB<{
    period: number;
    label: string;
    period_end: string;
    net_sales_gbp: number;
    cost_gbp: number;
  }>(`
    SELECT CAST(d.business_period_number AS INTEGER) AS period,
           ANY_VALUE(d.business_period_label) AS label,
           CAST(MAX(d.full_date) AS VARCHAR) AS period_end,
           CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS net_sales_gbp,
           CAST(SUM(x.cost_gbp) AS DOUBLE) AS cost_gbp
    FROM fact_sales_daily x
    JOIN dim_date d ON x.date = d.full_date
    JOIN dim_store s ON x.store_id = s.store_id
    WHERE ${tyDates(f, "x.date")} ${marketAnd(f, "s")}
    GROUP BY 1
    ORDER BY 1
  `);

  // A period is still trading if the selection ends before the period does.
  const periodEnds = await queryDuckDB<{ period: number; period_end: string }>(`
    SELECT CAST(business_period_number AS INTEGER) AS period, CAST(MAX(full_date) AS VARCHAR) AS period_end
    FROM dim_date WHERE business_year = ${f.year} GROUP BY 1
  `);
  const endOf = new Map(periodEnds.map((p) => [p.period, p.period_end]));

  return rows.map((r) => ({
    period: r.period,
    label: r.label,
    salesGbp: r.net_sales_gbp,
    marginPct: r.net_sales_gbp > 0 ? (1 - r.cost_gbp / r.net_sales_gbp) * 100 : 0,
    isPartial: (endOf.get(r.period) ?? "") > f.tyEnd,
  }));
}