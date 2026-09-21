-- 01 · Explore the warehouse
--
-- Before writing any analysis, find out what's there. This is the first thing
-- to do with any database you've been handed: what tables exist, how big they
-- are, what the columns mean, and what a row actually looks like.
--
-- Run one query:   python sql/duck.py run sql/queries/01_explore_the_warehouse.sql --only 3
-- Run them all:    python sql/duck.py run sql/queries/01_explore_the_warehouse.sql

-- ## 1. What tables are there?
-- information_schema is the standard way to ask a database about itself. It
-- works in SQL Server, Postgres and MySQL too, not just DuckDB.
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'main'
ORDER BY table_name;

-- ## 2. How big is each table?
-- UNION ALL stacks result sets on top of each other. Each SELECT must return
-- the same number of columns in the same order.
SELECT 'dim_date' AS table_name, COUNT(*) AS row_count FROM dim_date
UNION ALL SELECT 'dim_store',   COUNT(*) FROM dim_store
UNION ALL SELECT 'dim_product', COUNT(*) FROM dim_product
UNION ALL SELECT 'dim_promo',   COUNT(*) FROM dim_promo
UNION ALL SELECT 'fact_sales',          COUNT(*) FROM fact_sales
UNION ALL SELECT 'fact_footfall',       COUNT(*) FROM fact_footfall
UNION ALL SELECT 'fact_stock_snapshot', COUNT(*) FROM fact_stock_snapshot
UNION ALL SELECT 'fact_store_finance',  COUNT(*) FROM fact_store_finance
UNION ALL SELECT 'fact_targets',        COUNT(*) FROM fact_targets
UNION ALL SELECT 'fact_digital_sales',  COUNT(*) FROM fact_digital_sales
UNION ALL SELECT 'fact_digital_traffic', COUNT(*) FROM fact_digital_traffic
ORDER BY row_count DESC;

-- ## 3. What columns does a table have?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fact_sales'
ORDER BY ordinal_position;

-- ## 4. What does a row look like?
-- LIMIT stops a 3.9 million row table from flooding the screen. Always peek at
-- a few rows before you trust a column name.
SELECT * FROM fact_sales LIMIT 10;

-- ## 5. DESCRIBE, the DuckDB shortcut for query 3
DESCRIBE dim_store;

-- ## 6. What period does the data cover, and at what grain?
-- "Grain" is what one row means. fact_sales is one row per invoice line;
-- fact_footfall is one row per store per day. Getting the grain wrong is the
-- most common cause of wrong numbers in joins (query 5 in 04_joins.sql).
SELECT
    MIN(date)                AS first_day,
    MAX(date)                AS last_day,
    COUNT(DISTINCT date)     AS days_with_sales,
    COUNT(DISTINCT store_id) AS stores_trading,
    COUNT(DISTINCT invoice_id) AS invoices
FROM fact_sales;

-- ## 7. What values does a category column hold?
-- GROUP BY + COUNT(*) is the quickest way to see the distinct values of a
-- column and how common each one is.
SELECT channel, COUNT(*) AS stores
FROM dim_store
GROUP BY channel
ORDER BY stores DESC;

-- ## 8. How many NULLs are in each column?
-- COUNT(*) counts rows, COUNT(column) counts non-NULL values, so the
-- difference is the number of NULLs. Multi-buy and base promos have no dates.
SELECT
    COUNT(*)                     AS promos,
    COUNT(*) - COUNT(start_date) AS null_start_dates,
    COUNT(*) - COUNT(end_date)   AS null_end_dates,
    COUNT(*) - COUNT(discount_pct) AS null_discounts
FROM dim_promo;

-- ## 9. SUMMARIZE, DuckDB's one-line profile of every column
-- Min, max, approximate distinct count, average, quartiles and NULL % for every
-- column in one go. Very handy when you meet a table for the first time.
SUMMARIZE dim_store;

-- ## 10. Look at the flat table used for early practice
-- v_sales_flat is fact_sales already joined to the store, product, promo and
-- calendar tables, so you can practise SELECT / WHERE / GROUP BY on one table
-- before learning joins. The joins that build it are in duck.py.
SELECT * FROM v_sales_flat LIMIT 5;