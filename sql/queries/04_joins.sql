-- 04 · Joins
--
-- Facts hold the numbers, dimensions hold the descriptions, and joins connect
-- them. fact_sales only has a store_id; the store's name, channel and market
-- live in dim_store.

-- ## 1. INNER JOIN: sales by channel and market
-- An inner join keeps only rows that match on both sides. Aliases (f, s, d)
-- keep the query readable. Business year 2025 = 1 Mar 2025 to end of Feb 2026.
SELECT
    s.channel,
    s.market_name,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date  d ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY s.channel, s.market_name
ORDER BY net_sales_gbp DESC
LIMIT 15;

-- ## 2. Three dimensions at once: brand by major product group
SELECT
    p.brand_name,
    p.major_product_group,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp,
    SUM(f.quantity)                AS net_units
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.brand_name, p.major_product_group
ORDER BY p.brand_name, net_sales_gbp DESC;

-- ## 3. LEFT JOIN to find what's missing
-- A LEFT JOIN keeps every row from the left table, with NULLs where nothing
-- matched on the right. Filtering for those NULLs finds the gaps: SKUs that
-- have never appeared on an invoice.
SELECT p.sku, p.style_name, p.brand_name, p.product_group
FROM dim_product p
LEFT JOIN fact_sales f ON p.sku = f.sku
WHERE f.sku IS NULL
ORDER BY p.sku;

-- ## 4. The same question with NOT EXISTS
-- Same answer as query 3, written as an "anti-join". On big tables NOT EXISTS
-- is often the clearer way to say "no matching row".
SELECT p.sku, p.style_name
FROM dim_product p
WHERE NOT EXISTS (SELECT 1 FROM fact_sales f WHERE f.sku = p.sku)
ORDER BY p.sku;

-- ## 5. The fan-out trap: joining two fact tables directly
-- fact_sales is many rows per store-day, fact_footfall is one. Join them
-- straight together and every footfall row is repeated once per sales line, so
-- footfall is hugely overstated. The first column below is WRONG.
SELECT
    SUM(ff.footfall) AS footfall_wrong,
    (SELECT SUM(footfall) FROM fact_footfall
      WHERE date BETWEEN DATE '2025-03-01' AND DATE '2025-03-07') AS footfall_correct
FROM fact_footfall ff
JOIN fact_sales fs ON fs.store_id = ff.store_id AND fs.date = ff.date
WHERE ff.date BETWEEN DATE '2025-03-01' AND DATE '2025-03-07';

-- ## 6. The fix: aggregate each fact to the same grain, then join
-- Both sides are reduced to one row per store-day first, so nothing can
-- multiply. This is the pattern to reach for whenever two fact tables meet.
WITH sales_by_store_day AS (
    SELECT store_id, date, SUM(net_sales_gbp) AS net_sales_gbp
    FROM fact_sales
    WHERE date BETWEEN DATE '2025-03-01' AND DATE '2025-03-07'
    GROUP BY store_id, date
),
footfall_by_store_day AS (
    SELECT store_id, date, SUM(footfall) AS footfall
    FROM fact_footfall
    WHERE date BETWEEN DATE '2025-03-01' AND DATE '2025-03-07'
    GROUP BY store_id, date
)
SELECT
    SUM(ff.footfall)       AS footfall_correct,
    ROUND(SUM(s.net_sales_gbp), 0) AS net_sales_gbp,
    ROUND(SUM(s.net_sales_gbp) / SUM(ff.footfall), 2) AS sales_per_visitor_gbp
FROM footfall_by_store_day ff
LEFT JOIN sales_by_store_day s ON s.store_id = ff.store_id AND s.date = ff.date;

-- ## 7. CROSS JOIN: every combination, then look for gaps
-- Every store x every business period should have a target. A CROSS JOIN
-- builds all the combinations that SHOULD exist, and a LEFT JOIN finds any
-- that don't. An empty result is the good outcome here: nothing is missing.
-- expect: no rows
SELECT s.store_id, p.period_key
FROM dim_store s
CROSS JOIN dim_period p
LEFT JOIN fact_targets t ON t.store_id = s.store_id AND t.period_key = p.period_key
WHERE t.store_id IS NULL
LIMIT 20;

-- ## 8. A join on a date range instead of a key
-- Joins don't have to be on equality. This matches each promotion to every
-- calendar day inside its window, to count how many days each ran for.
SELECT
    pr.promo_name,
    pr.promo_type,
    pr.discount_pct,
    COUNT(d.full_date) AS days_running
FROM dim_promo pr
JOIN dim_date d ON d.full_date BETWEEN pr.start_date AND pr.end_date
GROUP BY pr.promo_name, pr.promo_type, pr.discount_pct, pr.start_date
ORDER BY pr.start_date
LIMIT 12;

-- ## 9. UNION ALL: two sources for the same thing, side by side
-- fact_sales holds every channel, including Online. fact_digital_sales is the
-- website's own view (by market and device). They should tell the same story,
-- but not to the penny: fact_sales nets off returns, digital sales are before
-- returns. That gap is exactly the returns figure (see 11_data_quality_checks).
SELECT 'Online channel in fact_sales (after returns)' AS source,
       ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE s.channel = 'Online' AND d.business_year = 2025
UNION ALL
SELECT 'fact_digital_sales (before returns)', ROUND(SUM(f.net_sales_gbp), 0)
FROM fact_digital_sales f
JOIN dim_date d ON f.date = d.full_date
WHERE d.business_year = 2025;

-- ## 10. Joining the same table to itself
-- Pairs of styles in the same product group at very similar prices. The
-- style_code inequality (<) stops a style pairing with itself and stops each
-- pair appearing twice.
WITH styles AS (
    SELECT DISTINCT style_code, style_name, product_group, base_price_gbp FROM dim_product
)
SELECT a.style_name AS style_a, b.style_name AS style_b, a.product_group, a.base_price_gbp, b.base_price_gbp AS price_b
FROM styles a
JOIN styles b
  ON a.product_group = b.product_group
 AND a.style_code < b.style_code
 AND ABS(a.base_price_gbp - b.base_price_gbp) < 0.5
ORDER BY a.product_group, a.base_price_gbp
LIMIT 10;