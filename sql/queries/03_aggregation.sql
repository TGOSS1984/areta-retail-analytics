-- 03 · Aggregation: GROUP BY, HAVING and friends
--
-- Turning millions of rows into a handful of numbers. Every KPI on the
-- report is an aggregation.

-- ## 1. The headline numbers
-- The same figures as Net Sales (GBP), Net Units Sold and Distinct Invoices
-- in Power BI. Returns are negative lines, so SUM already nets them off.
SELECT
    ROUND(SUM(net_sales_gbp), 2)  AS net_sales_gbp,
    SUM(quantity)                 AS net_units_sold,
    COUNT(*)                      AS invoice_lines,
    COUNT(DISTINCT invoice_id)    AS invoices
FROM fact_sales;

-- ## 2. GROUP BY one column
SELECT is_return, COUNT(*) AS lines, ROUND(SUM(net_sales_gbp), 2) AS net_sales_gbp
FROM fact_sales
GROUP BY is_return;

-- ## 3. GROUP BY a date part
-- DATE_TRUNC rounds a date down to the start of its month, quarter, year...
SELECT
    DATE_TRUNC('month', date) AS month,
    ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales
GROUP BY month
ORDER BY month DESC
LIMIT 12;

-- ## 4. Gross margin %: a ratio of two sums
-- Sum first, divide after. Averaging each row's margin % would weight a £5
-- line the same as a £500 one. NULLIF stops a divide-by-zero.
SELECT
    ROUND(SUM(net_sales_gbp), 2)                                   AS net_sales_gbp,
    ROUND(SUM(net_sales_gbp - cost_gbp), 2)                        AS gross_profit_gbp,
    ROUND(SUM(net_sales_gbp - cost_gbp) / NULLIF(SUM(net_sales_gbp), 0), 4) AS gross_margin_pct
FROM fact_sales;

-- ## 5. HAVING filters the groups, WHERE filters the rows
-- WHERE runs before grouping, HAVING runs after, so only HAVING can see the
-- SUM. Stores that sold more than £500k in calendar 2025:
SELECT store_id, ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales
WHERE date >= DATE '2025-01-01' AND date < DATE '2026-01-01'
GROUP BY store_id
HAVING SUM(net_sales_gbp) > 500000
ORDER BY net_sales_gbp DESC;

-- ## 6. Conditional aggregation: several measures in one pass
-- SUM(CASE WHEN ...) works in every database. The FILTER form below it is
-- DuckDB and Postgres, and reads a little better.
SELECT
    ROUND(SUM(CASE WHEN is_return THEN net_sales_gbp ELSE 0 END), 2) AS returns_gbp_case,
    ROUND(SUM(net_sales_gbp) FILTER (WHERE is_return), 2)           AS returns_gbp_filter,
    ROUND(SUM(net_sales_gbp) FILTER (WHERE NOT is_return), 2)       AS sales_before_returns_gbp
FROM fact_sales;

-- ## 7. COUNT(DISTINCT) and averages
-- Average invoice value = total sales / number of invoices. AVG(net_sales_gbp)
-- would be the average LINE value, which is a different thing.
SELECT
    ROUND(SUM(net_sales_gbp) / COUNT(DISTINCT invoice_id), 2) AS avg_invoice_value_gbp,
    ROUND(AVG(net_sales_gbp), 2)                              AS avg_line_value_gbp,
    ROUND(SUM(quantity)::DOUBLE / COUNT(DISTINCT invoice_id), 2) AS units_per_invoice
FROM fact_sales
WHERE NOT is_return;

-- ## 8. Median and percentiles
-- The average is pulled around by a few huge values, so the median (the middle
-- value) is often the fairer number.
SELECT
    ROUND(AVG(net_sales_gbp), 2)                     AS mean_line_gbp,
    ROUND(MEDIAN(net_sales_gbp), 2)                  AS median_line_gbp,
    ROUND(QUANTILE_CONT(net_sales_gbp, 0.9), 2)      AS p90_line_gbp
FROM fact_sales
WHERE NOT is_return;

-- ## 9. ROLLUP: subtotals and a grand total
-- Each year's footfall, plus a NULL-labelled grand total row at the bottom.
SELECT
    EXTRACT(year FROM date) AS calendar_year,
    SUM(footfall)           AS visitors,
    SUM(transactions)       AS transactions
FROM fact_footfall
GROUP BY ROLLUP (calendar_year)
ORDER BY calendar_year;

-- ## 10. Counting with a condition: how many sales lines per promo?
SELECT promo_id, COUNT(*) AS lines, ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales
GROUP BY promo_id
ORDER BY lines DESC
LIMIT 8;