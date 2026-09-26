import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { lyDates, tyDates } from "@/lib/filters/sql";

// Queries behind the Products page. All of them read the style-colour
// export, which is kept at date x style x colour with no store so it stays
// small. That means this page follows the year and period filters but not
// the market one, and says so on the page.

export type ProductsSummary = {
  salesTy: number;
  salesLy: number | null;
  unitsTy: number;
  unitsLy: number | null;
  aspTy: number;
  aspLy: number | null;
  stylesSelling: number;
  stylesSellingLy: number | null;
};

export async function fetchProductsSummary(f: ResolvedFilters): Promise<ProductsSummary> {
  const [r] = await queryDuckDB<{
    sales_ty: number; sales_ly: number | null; units_ty: number; units_ly: number | null;
    styles_ty: number; styles_ly: number | null;
  }>(`
    SELECT
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS sales_ty,
      CAST(SUM(x.net_sales_gbp) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS sales_ly,
      CAST(SUM(x.quantity) FILTER (WHERE ${tyDates(f, "x.date")}) AS DOUBLE) AS units_ty,
      CAST(SUM(x.quantity) FILTER (WHERE ${lyDates(f, "x.date")}) AS DOUBLE) AS units_ly,
      CAST(COUNT(DISTINCT x.style_code) FILTER (WHERE ${tyDates(f, "x.date")} AND x.quantity > 0) AS DOUBLE) AS styles_ty,
      CAST(COUNT(DISTINCT x.style_code) FILTER (WHERE ${lyDates(f, "x.date")} AND x.quantity > 0) AS DOUBLE) AS styles_ly
    FROM fact_sales_style_colour_daily x
    WHERE ${tyDates(f, "x.date")} OR ${lyDates(f, "x.date")}
  `);
  const hasLy = f.hasLastYear && !!r.sales_ly;
  return {
    salesTy: r.sales_ty ?? 0,
    salesLy: hasLy ? r.sales_ly : null,
    unitsTy: r.units_ty ?? 0,
    unitsLy: hasLy ? r.units_ly : null,
    aspTy: r.units_ty ? (r.sales_ty ?? 0) / r.units_ty : 0,
    aspLy: hasLy && r.units_ly ? (r.sales_ly ?? 0) / r.units_ly : null,
    stylesSelling: r.styles_ty ?? 0,
    stylesSellingLy: hasLy ? r.styles_ly : null,
  };
}

export type StyleSales = {
  styleCode: string;
  styleName: string;
  brand: string;
  productGroup: string;
  sales: number;
  units: number;
};

/** One row per style (all its colours together) for the selection,
 * best-selling first. Ranked by style_code, not style_name, because names
 * repeat across brands; the Pareto, scatter and treemap all read this. */
export async function fetchStyleSales(f: ResolvedFilters): Promise<StyleSales[]> {
  return queryDuckDB<StyleSales>(`
    WITH styles AS (
      SELECT style_code, ANY_VALUE(style_name) AS style_name, ANY_VALUE(brand_name) AS brand_name,
             ANY_VALUE(product_group) AS product_group
      FROM dim_style_colour
      GROUP BY style_code
    )
    SELECT x.style_code AS "styleCode", s.style_name AS "styleName", s.brand_name AS brand,
           s.product_group AS "productGroup",
           CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales,
           CAST(SUM(x.quantity) AS DOUBLE) AS units
    FROM fact_sales_style_colour_daily x
    JOIN styles s ON s.style_code = x.style_code
    WHERE ${tyDates(f, "x.date")}
    GROUP BY 1, 2, 3, 4
    HAVING SUM(x.quantity) > 0
    ORDER BY sales DESC
  `);
}

export type RankedProduct = {
  styleCode: string;
  colourCode: string;
  styleName: string;
  colour: string;
  brand: string;
  majorProductGroup: string;
  imagePath: string;
  sales: number;
  salesLy: number | null;
  units: number;
  /** Weekly sales across the selection, oldest first, for a sparkline. */
  weekly: number[];
};

const CODE = /^[A-Z0-9-]+$/;

/** The ten best or ten slowest style-colours in the selection, each with
 * last year and a weekly sparkline. "Slowest" only counts style-colours
 * that sold at least once: a line that sold nothing is a range question,
 * not a sales one. */
export async function fetchProductRanking(f: ResolvedFilters, which: "best" | "slowest"): Promise<RankedProduct[]> {
  const rows = await queryDuckDB<{
    style_code: string; colour_code: string; style_name: string; colour: string; brand_name: string;
    major_product_group: string; image_path: string; sales: number; units: number; sales_ly: number | null;
  }>(`
    WITH ty AS (
      SELECT style_code, colour_code, SUM(net_sales_gbp) AS sales, SUM(quantity) AS units
      FROM fact_sales_style_colour_daily x
      WHERE ${tyDates(f, "x.date")}
      GROUP BY 1, 2
      -- Positive sales as well as units: a line where returns outweighed
      -- sales isn't a slow seller, it's a returns question.
      HAVING SUM(quantity) > 0 AND SUM(net_sales_gbp) > 0
      ORDER BY sales ${which === "best" ? "DESC" : "ASC"}
      LIMIT 10
    ),
    ly AS (
      SELECT x.style_code, x.colour_code, SUM(x.net_sales_gbp) AS sales_ly
      FROM fact_sales_style_colour_daily x
      JOIN ty ON ty.style_code = x.style_code AND ty.colour_code = x.colour_code
      WHERE ${lyDates(f, "x.date")}
      GROUP BY 1, 2
    )
    SELECT ty.style_code, ty.colour_code, s.style_name, s.colour, s.brand_name, s.major_product_group,
           s.image_path, CAST(ty.sales AS DOUBLE) AS sales, CAST(ty.units AS DOUBLE) AS units,
           CAST(ly.sales_ly AS DOUBLE) AS sales_ly
    FROM ty
    JOIN dim_style_colour s ON s.style_code = ty.style_code AND s.colour_code = ty.colour_code
    LEFT JOIN ly ON ly.style_code = ty.style_code AND ly.colour_code = ty.colour_code
    ORDER BY ty.sales ${which === "best" ? "DESC" : "ASC"}
  `);

  const keys = rows
    .map((r) => `${r.style_code}|${r.colour_code}`)
    .filter((k) => k.split("|").every((part) => CODE.test(part)));
  const weeklyRows = keys.length
    ? await queryDuckDB<{ k: string; week: number; sales: number }>(`
        SELECT x.style_code || '|' || x.colour_code AS k, CAST(d.business_week_number AS INTEGER) AS week,
               CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales
        FROM fact_sales_style_colour_daily x
        JOIN dim_date d ON d.full_date = x.date
        WHERE ${tyDates(f, "x.date")} AND x.style_code || '|' || x.colour_code IN (${keys.map((k) => `'${k}'`).join(", ")})
        GROUP BY 1, 2
      `)
    : [];
  const [firstWeek, lastWeek] = await weekRange(f);
  const weekly = new Map<string, number[]>();
  for (const k of keys) weekly.set(k, Array.from({ length: lastWeek - firstWeek + 1 }, () => 0));
  for (const w of weeklyRows) {
    const arr = weekly.get(w.k);
    if (arr && w.week >= firstWeek && w.week <= lastWeek) arr[w.week - firstWeek] = w.sales;
  }

  return rows.map((r) => ({
    styleCode: r.style_code,
    colourCode: r.colour_code,
    styleName: r.style_name,
    colour: r.colour,
    brand: r.brand_name,
    majorProductGroup: r.major_product_group,
    imagePath: r.image_path,
    sales: r.sales,
    salesLy: f.hasLastYear ? r.sales_ly : null,
    units: r.units,
    weekly: weekly.get(`${r.style_code}|${r.colour_code}`) ?? [],
  }));
}

async function weekRange(f: ResolvedFilters): Promise<[number, number]> {
  const [r] = await queryDuckDB<{ lo: number; hi: number }>(`
    SELECT CAST(MIN(business_week_number) AS INTEGER) AS lo, CAST(MAX(business_week_number) AS INTEGER) AS hi
    FROM dim_date WHERE ${tyDates(f, "full_date")}
  `);
  return [r.lo, r.hi];
}