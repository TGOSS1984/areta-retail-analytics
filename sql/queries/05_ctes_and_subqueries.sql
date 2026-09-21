-- 05 · CTEs and subqueries
--
-- A CTE (WITH ... AS) names an intermediate result so a long query can be
-- read top to bottom, one step at a time. Subqueries do the same job inline.

-- ## 1. Subquery in WHERE: above-average prices
SELECT sku, style_name, base_price_gbp
FROM dim_product
WHERE base_price_gbp > (SELECT AVG(base_price_gbp) FROM dim_product)
ORDER BY base_price_gbp DESC
LIMIT 10;

-- ## 2. Scalar subquery in SELECT: share of the total
-- The subquery in the SELECT returns one number (the grand total), which is
-- reused on every row.
SELECT
    s.market_name,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp) / (SELECT SUM(net_sales_gbp) FROM fact_sales), 4) AS share_of_total
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
GROUP BY s.market_name
ORDER BY net_sales_gbp DESC;

-- ## 3. A first CTE: top 10 stores in 2025
WITH store_sales AS (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id
)
SELECT s.store_name, s.market_name, s.channel, ROUND(ss.net_sales_gbp, 0) AS net_sales_gbp
FROM store_sales ss
JOIN dim_store s ON ss.store_id = s.store_id
ORDER BY ss.net_sales_gbp DESC
LIMIT 10;

-- ## 4. Chaining CTEs: each store against the company average
-- The second CTE reads from the first. Building a query in named steps like
-- this makes it far easier to debug than one giant SELECT.
WITH store_sales AS (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id
),
benchmark AS (
    SELECT AVG(net_sales_gbp) AS avg_store_sales FROM store_sales
)
SELECT
    s.store_name,
    ROUND(ss.net_sales_gbp, 0)                       AS net_sales_gbp,
    ROUND(ss.net_sales_gbp / b.avg_store_sales, 2)   AS vs_average
FROM store_sales ss
CROSS JOIN benchmark b
JOIN dim_store s ON ss.store_id = s.store_id
ORDER BY vs_average DESC
LIMIT 10;

-- ## 5. Correlated subquery: stores beating their own market's average
-- The inner query refers to the outer row (ss.market_code), so it re-runs
-- for each market. Powerful, but a window function (06_window_functions.sql)
-- is usually neater for this.
WITH store_sales AS (
    SELECT s.store_id, s.store_name, s.market_code, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_store s ON f.store_id = s.store_id
    JOIN dim_date d  ON f.date = d.full_date
    WHERE d.business_year = 2025 AND s.channel = 'Retail'
    GROUP BY s.store_id, s.store_name, s.market_code
)
SELECT ss.store_name, ss.market_code, ROUND(ss.net_sales_gbp, 0) AS net_sales_gbp
FROM store_sales ss
WHERE ss.net_sales_gbp > (
    SELECT AVG(x.net_sales_gbp) FROM store_sales x WHERE x.market_code = ss.market_code
)
ORDER BY ss.market_code, ss.net_sales_gbp DESC
LIMIT 15;

-- ## 6. EXISTS: styles that sold online
SELECT p.style_code, p.style_name
FROM (SELECT DISTINCT style_code, style_name FROM dim_product) p
WHERE EXISTS (
    SELECT 1
    FROM fact_sales f
    JOIN dim_product pp ON f.sku = pp.sku
    JOIN dim_store s    ON f.store_id = s.store_id
    WHERE pp.style_code = p.style_code AND s.channel = 'Online'
)
ORDER BY p.style_code
LIMIT 10;

-- ## 7. IN with a subquery: promotions that were actually used
SELECT promo_id, promo_name, promo_type, discount_pct
FROM dim_promo
WHERE promo_id IN (SELECT DISTINCT promo_id FROM fact_sales)
ORDER BY promo_id
LIMIT 10;

-- ## 8. A recursive CTE: build a calendar and look for gaps
-- WITH RECURSIVE starts from one row and keeps adding rows until a condition
-- stops it. Here it builds every expected weekly stock snapshot date, then a
-- LEFT JOIN checks each one exists. (No NULLs in the last column = no gaps.)
WITH RECURSIVE expected_weeks(week_ending) AS (
    SELECT MIN(week_ending_date) FROM fact_stock_snapshot
    UNION ALL
    SELECT week_ending + 7 FROM expected_weeks
    WHERE week_ending < (SELECT MAX(week_ending_date) FROM fact_stock_snapshot)
),
actual_weeks AS (
    SELECT DISTINCT week_ending_date FROM fact_stock_snapshot
)
SELECT
    COUNT(*)                                    AS expected_snapshots,
    COUNT(a.week_ending_date)                   AS found,
    COUNT(*) - COUNT(a.week_ending_date)        AS missing
FROM expected_weeks e
LEFT JOIN actual_weeks a ON a.week_ending_date = e.week_ending;

-- ## 9. Derived table: aggregate an aggregate
-- "How many stores sell in each 'bucket' of yearly sales?" First sum per
-- store, then count the stores in each band.
SELECT
    band,
    COUNT(*) AS stores
FROM (
    SELECT
        store_id,
        CASE
            WHEN SUM(net_sales_gbp) < 100000 THEN 'a. Under £100k'
            WHEN SUM(net_sales_gbp) < 250000 THEN 'b. £100k-£250k'
            WHEN SUM(net_sales_gbp) < 500000 THEN 'c. £250k-£500k'
            ELSE                                  'd. Over £500k'
        END AS band
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY store_id
) banded
GROUP BY band
ORDER BY band;

-- ## 10. WHERE vs HAVING with a subquery: products selling above the median
WITH style_sales AS (
    SELECT p.style_code, p.style_name, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_product p ON f.sku = p.sku
    GROUP BY p.style_code, p.style_name
)
SELECT style_name, ROUND(net_sales_gbp, 0) AS net_sales_gbp
FROM style_sales
WHERE net_sales_gbp > (SELECT MEDIAN(net_sales_gbp) FROM style_sales)
ORDER BY net_sales_gbp DESC
LIMIT 10;