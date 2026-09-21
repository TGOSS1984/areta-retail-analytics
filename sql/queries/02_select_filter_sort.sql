-- 02 · SELECT, filter, sort
--
-- The building blocks: pick columns, keep the rows you want, put them in
-- order. Everything later builds on these.

-- ## 1. Pick columns and limit the rows
SELECT store_name, city, region
FROM dim_store
WHERE market_code = 'UK'
ORDER BY store_name
LIMIT 15;

-- ## 2. Several conditions at once: AND, IN, BETWEEN, LIKE
-- AND needs every condition true. IN is shorthand for a list of ORs. LIKE
-- matches text patterns, where % means "anything".
SELECT sku, style_name, brand_name, base_price_gbp
FROM dim_product
WHERE brand_name IN ('Areta', 'Areta Pro')
  AND base_price_gbp BETWEEN 80 AND 120
  AND product_group LIKE '%Shell%'
ORDER BY base_price_gbp DESC
LIMIT 20;

-- ## 3. Top N: the ten most expensive SKUs
-- ORDER BY ... DESC then LIMIT is the standard "top N". (SQL Server writes
-- this as SELECT TOP 10 ...; the idea is the same.)
SELECT sku, style_name, brand_name, base_price_gbp
FROM dim_product
ORDER BY base_price_gbp DESC, sku
LIMIT 10;

-- ## 4. DISTINCT: what combinations exist?
SELECT DISTINCT major_product_group, product_group
FROM dim_product
ORDER BY major_product_group, product_group;

-- ## 5. CASE WHEN: turn numbers into labels
-- CASE is SQL's if / else. The first WHEN that is true wins, so order matters.
SELECT
    CASE
        WHEN base_price_gbp < 30  THEN '1. Under £30'
        WHEN base_price_gbp < 80  THEN '2. £30 to £80'
        WHEN base_price_gbp < 150 THEN '3. £80 to £150'
        ELSE                           '4. Over £150'
    END AS price_band,
    COUNT(*) AS skus
FROM dim_product
GROUP BY price_band
ORDER BY price_band;

-- ## 6. Filtering on a true/false column
-- dim_date has flags such as is_black_friday and is_weekend, so no date
-- arithmetic is needed to find them.
SELECT full_date, day_name, business_period_label
FROM dim_date
WHERE is_black_friday
ORDER BY full_date;

-- ## 7. NULLs: use IS NULL, never = NULL
-- Comparing anything to NULL with = gives NULL (unknown), which WHERE treats
-- as false. IS NULL is the only test that works.
SELECT promo_id, promo_name, promo_type
FROM dim_promo
WHERE start_date IS NULL
ORDER BY promo_id;

-- ## 8. Dates relative to the data, not to today
-- A subquery in brackets can supply a value. Here it finds the latest sales
-- date, so "last 30 days" means the last 30 days of the data.
SELECT COUNT(*) AS lines_last_30_days,
       ROUND(SUM(net_sales_gbp), 2) AS net_sales_gbp
FROM fact_sales
WHERE date > (SELECT MAX(date) FROM fact_sales) - INTERVAL 30 DAY;

-- ## 9. Text functions
-- A SKU is style-colour-size, so SPLIT_PART pulls the pieces apart.
SELECT
    sku,
    SPLIT_PART(sku, '-', 1) AS style_part,
    SPLIT_PART(sku, '-', 2) AS colour_part,
    UPPER(LEFT(style_name, 3)) AS style_prefix,
    LENGTH(style_name)         AS name_length
FROM dim_product
LIMIT 10;

-- ## 10. Sorting on more than one column
-- Rows are ordered by the first column, and ties are broken by the next.
SELECT store_name, market_name, channel
FROM dim_store
ORDER BY market_name ASC, channel DESC, store_name
LIMIT 20;