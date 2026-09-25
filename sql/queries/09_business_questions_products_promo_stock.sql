-- 09 · Business questions: products, promotions and stock
--
-- The Products, Categories, Promotional and Stock pages in SQL. Stock is a
-- weekly snapshot, so "how much stock do we have" means the LATEST snapshot,
-- never a sum across weeks (adding snapshots together counts the same units
-- again every week).

-- ## 1. What are the top 10 style-colours, and which image will each one show?
-- Grain is style AND colour, because that's what product photography exists at.
-- image_source says whether the picture is a real photo or a placeholder.
SELECT
    p.style_name, p.colour, p.brand_name,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp,
    SUM(f.quantity)                AS net_units,
    p.image_source
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.style_code, p.style_name, p.colour, p.colour_code, p.brand_name, p.image_source
ORDER BY net_sales_gbp DESC
LIMIT 10;

-- ## 2. How much of the range has its own photo?
-- A data-quality question about the catalogue itself.
SELECT
    image_source,
    COUNT(DISTINCT style_code || '-' || colour_code) AS style_colours,
    ROUND(COUNT(DISTINCT style_code || '-' || colour_code) * 1.0
        / SUM(COUNT(DISTINCT style_code || '-' || colour_code)) OVER (), 3) AS share
FROM dim_product
GROUP BY image_source
ORDER BY style_colours DESC;

-- ## 3. Category mix and margin: what do we sell, and what do we make on it?
SELECT
    p.major_product_group,
    p.product_group,
    ROUND(SUM(f.net_sales_gbp), 0)                                        AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp) / SUM(SUM(f.net_sales_gbp)) OVER (), 3)    AS share_of_sales,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp), 3)    AS gross_margin_pct
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.major_product_group, p.product_group
ORDER BY net_sales_gbp DESC
LIMIT 15;

-- ## 4. Brand performance by year, as a pivot
-- DuckDB has a PIVOT statement. The same thing written by hand with FILTER is
-- in 07 query 3, and is the version that works in every database.
SELECT * FROM (
    SELECT p.brand_name, d.business_year, f.net_sales_gbp
    FROM fact_sales f
    JOIN dim_product p ON f.sku = p.sku
    JOIN dim_date d    ON f.date = d.full_date
    WHERE d.business_year IN (2023, 2024, 2025)
)
PIVOT (ROUND(SUM(net_sales_gbp), 0) FOR business_year IN (2023, 2024, 2025))
ORDER BY brand_name;

-- ## 5. Do promotions pay for themselves? Margin by promotion type
-- Average discount is weighted by sales value, so a big-selling 30% event
-- counts for more than a tiny 70% one.
SELECT
    COALESCE(pr.promo_type, 'Full price') AS promo_type,
    ROUND(SUM(f.net_sales_gbp), 0)                                       AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp) / SUM(SUM(f.net_sales_gbp)) OVER (), 3)   AS share_of_sales,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp), 3)   AS gross_margin_pct,
    ROUND(SUM(f.discount_pct * f.net_sales_gbp) / SUM(f.net_sales_gbp), 1) AS avg_discount_pct
FROM fact_sales f
JOIN dim_promo pr ON f.promo_id = pr.promo_id
JOIN dim_date d   ON f.date = d.full_date
WHERE d.business_year = 2025 AND NOT f.is_return
GROUP BY COALESCE(pr.promo_type, 'Full price')
ORDER BY net_sales_gbp DESC;

-- ## 6. Full price mix by period: are we leaning on discounting?
-- The Full Price Mix % measure: sales with promo PROMO0000 over all sales.
SELECT
    d.business_period_label,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE f.promo_id = 'PROMO0000') / SUM(f.net_sales_gbp), 3) AS full_price_mix,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE f.promo_id LIKE 'MULTIBUY-%') / SUM(f.net_sales_gbp), 3) AS multi_buy_mix
FROM fact_sales f
JOIN dim_date d ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY d.period_key, d.business_period_label
ORDER BY d.period_key;

-- ## 6b. Black Friday: how do the promo days compare with normal trading?
-- Compares average daily sales during each Black Friday window with the 28
-- days before it. The date-range join (BETWEEN) from 04_joins is doing the work.
-- Expect roughly 1.5x across the four-day window: Black Friday itself runs at
-- about 2x a normal Friday and the weekend and Monday after at about 1.25x.
-- Before the generator modelled the shopper surge this came out at about 1.00,
-- because a 40% discount on its own lowers revenue per day.
WITH bf AS (
    SELECT promo_name, start_date, end_date
    FROM dim_promo
    WHERE promo_name LIKE 'Black Friday%' AND end_date <= (SELECT MAX(date) FROM fact_sales)
),
daily AS (SELECT date, SUM(net_sales_gbp) AS net_sales_gbp FROM fact_sales GROUP BY date)
SELECT
    bf.promo_name,
    ROUND(AVG(d.net_sales_gbp) FILTER (WHERE d.date BETWEEN bf.start_date AND bf.end_date), 0)      AS avg_daily_during,
    ROUND(AVG(d.net_sales_gbp) FILTER (WHERE d.date BETWEEN bf.start_date - 28 AND bf.start_date - 1), 0) AS avg_daily_prior_28,
    ROUND(AVG(d.net_sales_gbp) FILTER (WHERE d.date BETWEEN bf.start_date AND bf.end_date)
        / AVG(d.net_sales_gbp) FILTER (WHERE d.date BETWEEN bf.start_date - 28 AND bf.start_date - 1), 2) AS uplift
FROM bf
JOIN daily d ON d.date BETWEEN bf.start_date - 28 AND bf.end_date
GROUP BY bf.promo_name, bf.start_date
ORDER BY bf.start_date;

-- ## 7. Which products lean on multi-buy offers?
SELECT
    pr.promo_name,
    p.product_group,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp,
    SUM(f.quantity)                AS units
FROM fact_sales f
JOIN dim_promo pr  ON f.promo_id = pr.promo_id
JOIN dim_product p ON f.sku = p.sku
WHERE f.promo_id LIKE 'MULTIBUY-%'
GROUP BY pr.promo_name, p.product_group
ORDER BY net_sales_gbp DESC
LIMIT 10;

-- ## 8. How much stock do we hold right now?
-- One snapshot only: the latest. Summing across weeks would multiply the
-- stock by the number of weeks.
SELECT
    major_product_group,
    SUM(stock_units)                        AS stock_units,
    ROUND(SUM(stock_value_cost_gbp), 0)     AS stock_at_cost_gbp,
    ROUND(SUM(stock_value_retail_gbp), 0)   AS stock_at_retail_gbp
FROM fact_stock_snapshot
WHERE week_ending_date = (SELECT MAX(week_ending_date) FROM fact_stock_snapshot)
GROUP BY major_product_group
ORDER BY stock_at_retail_gbp DESC;

-- ## 9. Weeks of cover: how long will today's stock last?
-- Closing stock divided by average weekly units sold over the last four weeks.
-- Sales are units before returns, matching the Avg Weekly Sales measure.
WITH snapshot AS (SELECT MAX(week_ending_date) AS as_of FROM fact_stock_snapshot),
stock AS (
    SELECT major_product_group, SUM(stock_units) AS stock_units
    FROM fact_stock_snapshot, snapshot
    WHERE week_ending_date = snapshot.as_of
    GROUP BY major_product_group
),
sales AS (
    SELECT p.major_product_group, SUM(f.quantity) / 4.0 AS avg_weekly_units
    FROM fact_sales f
    JOIN dim_product p ON f.sku = p.sku, snapshot
    WHERE NOT f.is_return AND f.date > snapshot.as_of - 28 AND f.date <= snapshot.as_of
    GROUP BY p.major_product_group
)
SELECT
    st.major_product_group,
    st.stock_units,
    ROUND(sa.avg_weekly_units, 0)                         AS avg_weekly_units,
    ROUND(st.stock_units / sa.avg_weekly_units, 1)        AS weeks_of_cover
FROM stock st
JOIN sales sa ON st.major_product_group = sa.major_product_group
ORDER BY weeks_of_cover DESC;

-- ## 10. Slow movers: which style-colours will take longest to sell through?
-- Weeks of cover at style-colour level, using the last eight weeks of sales.
-- A LEFT JOIN keeps lines with stock but no recent sales at all (NULL cover,
-- sorted first because they're the worst).
WITH snapshot AS (SELECT MAX(week_ending_date) AS as_of FROM fact_stock_snapshot),
stock AS (
    SELECT style_code, colour, SUM(stock_units) AS stock_units
    FROM fact_stock_snapshot, snapshot
    WHERE week_ending_date = snapshot.as_of
    GROUP BY style_code, colour
    HAVING SUM(stock_units) >= 20
),
recent AS (
    SELECT dp.style_code, dp.colour, SUM(f.quantity) AS units_8_weeks
    FROM fact_sales f
    JOIN dim_product dp ON f.sku = dp.sku, snapshot
    WHERE NOT f.is_return AND f.date > snapshot.as_of - 56
    GROUP BY dp.style_code, dp.colour
)
SELECT
    p.style_name, st.colour, st.stock_units,
    COALESCE(r.units_8_weeks, 0) AS units_sold_8_weeks,
    ROUND(st.stock_units / NULLIF(COALESCE(r.units_8_weeks, 0) / 8.0, 0), 1) AS weeks_of_cover
FROM stock st
LEFT JOIN recent r ON st.style_code = r.style_code AND st.colour = r.colour
JOIN (SELECT DISTINCT style_code, style_name FROM dim_product) p ON st.style_code = p.style_code
ORDER BY weeks_of_cover DESC NULLS FIRST
LIMIT 10;

-- ## 11. Stock movement: how has total stock changed week to week?
-- LAG on the weekly totals, on the last 8 snapshots.
WITH weekly AS (
    SELECT week_ending_date, SUM(stock_units) AS stock_units
    FROM fact_stock_snapshot
    GROUP BY week_ending_date
)
SELECT
    week_ending_date,
    stock_units,
    stock_units - LAG(stock_units) OVER (ORDER BY week_ending_date) AS change_vs_prev_week
FROM weekly
ORDER BY week_ending_date DESC
LIMIT 8;