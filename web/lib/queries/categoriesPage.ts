import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, marketAnd, tyDates } from "@/lib/filters/sql";

// Queries behind the Categories page, all from the sales mix export (day x
// market x channel x product hierarchy x discount band), so everything here
// follows the market filter as well as the dates.

const MIX = "fact_sales_mix_daily";

export type GroupRow = {
  division: string;
  majorGroup: string;
  productGroup: string;
  salesTy: number;
  salesLy: number | null;
  costTy: number;
  costLy: number | null;
  unitsTy: number;
  unitsLy: number | null;
};

/** One row per division / major group / product group. Most product
 * groups appear once; Softshell, Gilets & Bodywarmers and Socks appear
 * under both of their major groups. */
export async function fetchGroupRows(f: ResolvedFilters): Promise<GroupRow[]> {
  const rows = await queryDuckDB<GroupRow>(`
    SELECT m.division, m.major_product_group AS "majorGroup", m.product_group AS "productGroup",
           CAST(COALESCE(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}), 0) AS DOUBLE) AS "salesTy",
           CAST(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS "salesLy",
           CAST(COALESCE(SUM(m.cost_gbp) FILTER (WHERE ${tyDates(f, "m.date")}), 0) AS DOUBLE) AS "costTy",
           CAST(SUM(m.cost_gbp) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS "costLy",
           CAST(COALESCE(SUM(m.quantity) FILTER (WHERE ${tyDates(f, "m.date")}), 0) AS DOUBLE) AS "unitsTy",
           CAST(SUM(m.quantity) FILTER (WHERE ${lyDates(f, "m.date")}) AS DOUBLE) AS "unitsLy"
    FROM ${MIX} m
    WHERE (${tyDates(f, "m.date")} OR ${lyDates(f, "m.date")}) ${marketAnd(f, "m")}
    GROUP BY 1, 2, 3
    ORDER BY "salesTy" DESC
  `);
  return f.hasLastYear ? rows : rows.map((r) => ({ ...r, salesLy: null, costLy: null, unitsLy: null }));
}

export type MarketGroupCell = { majorGroup: string; market: string; salesTy: number; salesLy: number };

/** Major group x market, this year and last, for the growth heatmap. With
 * one market selected it's a single column, which is still the honest
 * answer. */
export async function fetchMarketGroupGrowth(f: ResolvedFilters): Promise<MarketGroupCell[]> {
  return queryDuckDB<MarketGroupCell>(`
    WITH markets AS (SELECT market_code, ANY_VALUE(market_name) AS market_name FROM dim_store GROUP BY 1)
    SELECT m.major_product_group AS "majorGroup", mk.market_name AS market,
           CAST(COALESCE(SUM(m.net_sales_gbp) FILTER (WHERE ${tyDates(f, "m.date")}), 0) AS DOUBLE) AS "salesTy",
           CAST(COALESCE(SUM(m.net_sales_gbp) FILTER (WHERE ${lyDates(f, "m.date")}), 0) AS DOUBLE) AS "salesLy"
    FROM ${MIX} m
    JOIN markets mk ON mk.market_code = m.market_code
    WHERE (${tyDates(f, "m.date")} OR ${lyDates(f, "m.date")}) ${marketAnd(f, "m")}
    GROUP BY 1, 2
  `);
}

export type ChannelFlow = { channel: string; majorGroup: string; sales: number };

/** Channel to major group, for the Sankey. */
export async function fetchChannelFlows(f: ResolvedFilters): Promise<ChannelFlow[]> {
  return queryDuckDB<ChannelFlow>(`
    SELECT m.channel, m.major_product_group AS "majorGroup", CAST(SUM(m.net_sales_gbp) AS DOUBLE) AS sales
    FROM ${MIX} m
    WHERE ${tyDates(f, "m.date")} ${marketAnd(f, "m")}
    GROUP BY 1, 2
    HAVING SUM(m.net_sales_gbp) > 0
  `);
}