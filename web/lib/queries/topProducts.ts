import { queryDuckDB } from "@/lib/duckdb";

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

/** Same like-for-like YTD bounds as salesSummary.ts, monthlyTrend.ts and
 * salesMix.ts — current business year, elapsed periods only. Not shared
 * code with those for the same reason noted in salesMix.ts: different
 * tables joined, so a shared helper would need the query shape passed
 * in, which isn't simpler than repeating eight lines of SQL. */
async function currentYtdBounds(): Promise<{ year: number; maxPeriod: number }> {
  const yearRows = await queryDuckDB<{ current_year: number }>(`
    SELECT CAST(MAX(d.business_year) AS INTEGER) AS current_year
    FROM fact_sales_style_colour_daily f JOIN dim_date d ON f.date = d.full_date
  `);
  const year = yearRows[0].current_year;

  const periodRows = await queryDuckDB<{ max_period: number }>(`
    SELECT CAST(MAX(d.business_period_number) AS INTEGER) AS max_period
    FROM fact_sales_style_colour_daily f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = ${year}
  `);
  return { year, maxPeriod: periodRows[0].max_period };
}

/**
 * Ranked at (style, colour) grain, not style alone — a jacket in three
 * colours is three rows here, each with its own image_path, because
 * that's the grain product photography actually exists at. See
 * export_web_data.py's export_dim_style_colour() for why image_path is
 * exactly the SKU prefix (style_code-colour_code) rather than a
 * separately invented convention.
 */
export async function fetchTopProducts(limit = 10): Promise<TopProduct[]> {
  const { year, maxPeriod } = await currentYtdBounds();
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
    WHERE d.business_year = ${year} AND d.business_period_number <= ${maxPeriod}
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