import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { tyDates } from "@/lib/filters/sql";

export type TopProduct = {
  styleCode: string;
  colourCode: string;
  styleName: string;
  colour: string;
  brandName: string;
  majorProductGroup: string;
  productGroup: string;
  imagePath: string;
  salesGbp: number;
  quantity: number;
};

/**
 * Ranked at (style, colour) grain, not style alone — a jacket in three
 * colours is three rows here, each with its own image_path, because
 * that's the grain product photography actually exists at. See
 * export_web_data.py's export_dim_style_colour() for why image_path is
 * exactly the SKU prefix (style_code-colour_code) rather than a
 * separately invented convention.
 */
/** Follows the year and period filters. It can't follow the market
 * filter: the style-colour export is kept at date x style x colour, with
 * no store, to keep the file small, so the card says "all markets" when
 * one is selected rather than quietly showing the wrong thing. */
export async function fetchTopProducts(f: ResolvedFilters, limit = 10): Promise<TopProduct[]> {
  const rows = await queryDuckDB<{
    style_code: string;
    colour_code: string;
    style_name: string;
    colour: string;
    brand_name: string;
    major_product_group: string;
    product_group: string;
    image_path: string;
    sales_gbp: number;
    quantity: number;
  }>(`
    SELECT
      s.style_code,
      s.colour_code,
      s.style_name,
      s.colour,
      s.brand_name,
      s.major_product_group,
      s.product_group,
      s.image_path,
      CAST(SUM(f.net_sales_gbp) AS DOUBLE) AS sales_gbp,
      CAST(SUM(f.quantity) AS INTEGER) AS quantity
    FROM fact_sales_style_colour_daily f
    JOIN dim_date d ON f.date = d.full_date
    JOIN dim_style_colour s ON f.style_code = s.style_code AND f.colour_code = s.colour_code
    WHERE ${tyDates(f, "f.date")}
    GROUP BY s.style_code, s.colour_code, s.style_name, s.colour, s.brand_name, s.major_product_group, s.product_group, s.image_path
    ORDER BY sales_gbp DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    styleCode: r.style_code,
    colourCode: r.colour_code,
    styleName: r.style_name,
    colour: r.colour,
    brandName: r.brand_name,
    majorProductGroup: r.major_product_group,
    productGroup: r.product_group,
    imagePath: r.image_path,
    salesGbp: r.sales_gbp,
    quantity: r.quantity,
  }));
}