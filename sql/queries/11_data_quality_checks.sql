-- 11 · Data quality checks in SQL
--
-- These are hand-written versions of checks the generator's audit runs
-- (generator/quality/build_data_quality.py), and they're the sort of thing to
-- run on any dataset you inherit. A check is written so that it returns the
-- BAD rows: an empty result means the data passed. Queries that should come
-- back empty carry an "-- expect: no rows" comment.

-- ## 1. Orphan keys: sales lines pointing at a store that doesn't exist
-- The classic anti-join. LEFT JOIN, then keep only the rows with no match.
-- expect: no rows
SELECT f.store_id, COUNT(*) AS lines
FROM fact_sales f
LEFT JOIN dim_store s ON f.store_id = s.store_id
WHERE s.store_id IS NULL
GROUP BY f.store_id;

-- ## 2. Orphan keys: sales lines with an unknown SKU
-- expect: no rows
SELECT f.sku, COUNT(*) AS lines
FROM fact_sales f
LEFT JOIN dim_product p ON f.sku = p.sku
WHERE p.sku IS NULL
GROUP BY f.sku;

-- ## 3. Duplicates: is any invoice line in the table twice?
-- GROUP BY the columns that should be unique, keep groups with more than one row.
-- expect: no rows
SELECT invoice_id, line_number, COUNT(*) AS copies
FROM fact_sales
GROUP BY invoice_id, line_number
HAVING COUNT(*) > 1;

-- ## 4. Duplicates: two footfall rows for the same store and day
-- expect: no rows
SELECT store_id, date, COUNT(*) AS copies
FROM fact_footfall
GROUP BY store_id, date
HAVING COUNT(*) > 1;

-- ## 5. Rules that must always hold: sale lines can't have negative sales
-- expect: no rows
SELECT date, store_id, invoice_id, sku, net_sales_gbp
FROM fact_sales
WHERE NOT is_return AND net_sales_gbp < 0
LIMIT 20;

-- ## 6. Arithmetic that should tie: gross = net + VAT, to the penny
-- expect: no rows
SELECT date, store_id, invoice_id, net_sales_gbp, vat_gbp, gross_sales_gbp
FROM fact_sales
WHERE ABS(gross_sales_gbp - (net_sales_gbp + vat_gbp)) > 0.05
LIMIT 20;

-- ## 7. Reconciliation: does the P&L agree with the sales table?
-- Two tables that both claim to know a store's net sales for a period. Sum the
-- sales to store x period, join, and list any that differ by more than £1.
-- (Online has no store P&L, so only the stores that have a P&L are compared.)
-- expect: no rows
WITH sales AS (
    SELECT f.store_id, d.period_key, SUM(f.net_sales_gbp) AS sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY f.store_id, d.period_key
)
SELECT fin.store_id, fin.period_key, ROUND(sa.sales_gbp, 2) AS from_sales, ROUND(fin.net_sales_gbp, 2) AS from_pnl
FROM fact_store_finance fin
LEFT JOIN sales sa ON sa.store_id = fin.store_id AND sa.period_key = fin.period_key
WHERE sa.sales_gbp IS NULL OR ABS(sa.sales_gbp - fin.net_sales_gbp) > 1;

-- ## 8. Reconciliation: website sales against the Online channel
-- Digital sales are BEFORE returns, so they're compared with Online sales lines
-- that aren't returns. Per market per day, they should agree to within £1.
-- expect: no rows
WITH online AS (
    SELECT f.date, s.market_code, SUM(f.net_sales_gbp) AS sales_gbp
    FROM fact_sales f JOIN dim_store s ON f.store_id = s.store_id
    WHERE s.channel = 'Online' AND NOT f.is_return
    GROUP BY f.date, s.market_code
),
digital AS (
    SELECT date, market_code, SUM(net_sales_gbp) AS sales_gbp
    FROM fact_digital_sales
    GROUP BY date, market_code
)
SELECT o.date, o.market_code, ROUND(o.sales_gbp, 2) AS from_fact_sales, ROUND(dg.sales_gbp, 2) AS from_digital
FROM online o
FULL JOIN digital dg ON o.date = dg.date AND o.market_code = dg.market_code
WHERE o.sales_gbp IS NULL OR dg.sales_gbp IS NULL OR ABS(o.sales_gbp - dg.sales_gbp) > 1
LIMIT 20;

-- ## 9. Reconciliation: footfall transactions against invoices
-- A transaction in fact_footfall should be one non-return invoice in fact_sales.
-- expect: no rows
WITH invoices AS (
    SELECT store_id, date, COUNT(DISTINCT invoice_id) AS invoices
    FROM fact_sales
    WHERE NOT is_return
    GROUP BY store_id, date
)
SELECT ff.store_id, ff.date, ff.transactions, COALESCE(i.invoices, 0) AS invoices
FROM fact_footfall ff
LEFT JOIN invoices i ON i.store_id = ff.store_id AND i.date = ff.date
WHERE ff.transactions <> COALESCE(i.invoices, 0)
LIMIT 20;

-- ## 10. Is the data fresh? Latest date in each fact table
SELECT 'fact_sales' AS table_name, MAX(date) AS latest_date FROM fact_sales
UNION ALL SELECT 'fact_footfall',        MAX(date) FROM fact_footfall
UNION ALL SELECT 'fact_digital_sales',   MAX(date) FROM fact_digital_sales
UNION ALL SELECT 'fact_digital_traffic', MAX(date) FROM fact_digital_traffic
UNION ALL SELECT 'fact_stock_snapshot',  MAX(week_ending_date) FROM fact_stock_snapshot
ORDER BY latest_date DESC;

-- ## 11. What did the generator's own audit find?
-- dq_check_results is written by the pipeline and feeds the Data Quality page.
-- This is a summary of its outcome, worst first.
SELECT category, status, COUNT(*) AS checks
FROM dq_check_results
GROUP BY category, status, status_order
ORDER BY status_order, category;

-- ## 12. Which checks are not clean passes?
SELECT check_id, category, check_name, rows_failed, rows_tested, status
FROM dq_check_results
WHERE status <> 'Pass'
ORDER BY status_order, check_id;

-- ## 13. Table profile: rows, nulls and freshness at a glance
SELECT table_name, table_type, row_count, null_cells, latest_data_date, days_behind_run, freshness_status
FROM dq_table_profile
ORDER BY row_count DESC;