-- 06 · Window functions
--
-- A window function calculates across a set of related rows WITHOUT collapsing
-- them the way GROUP BY does. Each row keeps its identity and gains a
-- calculated column: a rank, a running total, the previous row's value.
--
--   function() OVER (PARTITION BY <restart for each> ORDER BY <order within>)
--
-- Interviewers love these. Get comfortable with ROW_NUMBER, RANK, LAG, and
-- running totals.

-- ## 1. RANK within groups: top 3 styles in each major product group
-- PARTITION BY restarts the ranking for every major group. You can't filter on
-- a window function directly in WHERE, so the ranking sits in a CTE and the
-- outer query filters on it.
WITH style_sales AS (
    SELECT p.major_product_group, p.style_name, p.style_code,
           SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_product p ON f.sku = p.sku
    JOIN dim_date d    ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY p.major_product_group, p.style_name, p.style_code
),
ranked AS (
    SELECT *, RANK() OVER (PARTITION BY major_product_group ORDER BY net_sales_gbp DESC) AS rnk
    FROM style_sales
)
SELECT major_product_group, rnk, style_name, ROUND(net_sales_gbp, 0) AS net_sales_gbp
FROM ranked
WHERE rnk <= 3
ORDER BY major_product_group, rnk;

-- ## 2. The same with QUALIFY (DuckDB and Snowflake)
-- QUALIFY filters on a window function directly, so no extra CTE is needed.
-- SQL Server and Postgres don't have it, so know the CTE version above too.
SELECT p.major_product_group, p.style_name,
       ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.major_product_group, p.style_name
QUALIFY RANK() OVER (PARTITION BY p.major_product_group ORDER BY SUM(f.net_sales_gbp) DESC) <= 3
ORDER BY p.major_product_group, net_sales_gbp DESC;

-- ## 3. ROW_NUMBER vs RANK vs DENSE_RANK
-- All three number the rows in order; they differ on ties. Stores rounded to
-- the nearest £100k tie constantly, which makes the difference obvious:
--   ROW_NUMBER: 1,2,3,4   (never repeats)
--   RANK:       1,1,3,4   (ties share a number, then a gap)
--   DENSE_RANK: 1,1,2,3   (ties share a number, no gap)
WITH store_sales AS (
    SELECT store_id, ROUND(SUM(net_sales_gbp), -5) AS sales_rounded
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY store_id
)
SELECT
    store_id, sales_rounded,
    ROW_NUMBER() OVER (ORDER BY sales_rounded DESC, store_id) AS row_number,
    RANK()       OVER (ORDER BY sales_rounded DESC)           AS rank,
    DENSE_RANK() OVER (ORDER BY sales_rounded DESC)           AS dense_rank
FROM store_sales
ORDER BY sales_rounded DESC, store_id
LIMIT 12;

-- ## 4. Running total: cumulative sales through business year 2025
-- With ORDER BY inside OVER, SUM becomes a running total.
WITH period_sales AS (
    SELECT d.business_period_number AS period, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY d.business_period_number
)
SELECT
    period,
    ROUND(net_sales_gbp, 0)                                  AS net_sales_gbp,
    ROUND(SUM(net_sales_gbp) OVER (ORDER BY period), 0)      AS running_total_gbp
FROM period_sales
ORDER BY period;

-- ## 5. LAG: compare each row with the one before
-- Period-on-period change. LAG(x, 1) is "x from one row back". The first row
-- has nothing before it, so it's NULL.
WITH period_sales AS (
    SELECT d.period_key, d.business_period_label, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY d.period_key, d.business_period_label
)
SELECT
    business_period_label,
    ROUND(net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(LAG(net_sales_gbp) OVER (ORDER BY period_key), 0) AS prev_period_gbp,
    ROUND(net_sales_gbp / LAG(net_sales_gbp) OVER (ORDER BY period_key) - 1, 3) AS change_pct
FROM period_sales
ORDER BY period_key;

-- ## 6. Year on year with LAG(12)
-- There are 12 business periods a year, so the same period last year is 12
-- rows back. This is the SQL version of the LY measures in the report.
-- The newest period is still in progress, so its YoY looks like a big drop.
-- When you report on this, filter to completed periods (07_business_questions_sales, query 2).
WITH period_sales AS (
    SELECT d.period_key, d.business_period_label, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY d.period_key, d.business_period_label
)
SELECT
    business_period_label,
    ROUND(net_sales_gbp, 0)                                    AS net_sales_gbp,
    ROUND(LAG(net_sales_gbp, 12) OVER (ORDER BY period_key), 0) AS same_period_ly_gbp,
    ROUND(net_sales_gbp / LAG(net_sales_gbp, 12) OVER (ORDER BY period_key) - 1, 3) AS yoy_pct
FROM period_sales
ORDER BY period_key DESC
LIMIT 12;

-- ## 7. Moving average: smooth out the noise
-- ROWS BETWEEN 3 PRECEDING AND CURRENT ROW = this period plus the three
-- before it, a 4-period rolling average.
WITH period_sales AS (
    SELECT d.period_key, d.business_period_label, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY d.period_key, d.business_period_label
)
SELECT
    business_period_label,
    ROUND(net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(AVG(net_sales_gbp) OVER (ORDER BY period_key ROWS BETWEEN 3 PRECEDING AND CURRENT ROW), 0) AS moving_avg_4_periods
FROM period_sales
ORDER BY period_key DESC
LIMIT 10;

-- ## 8. Percent of total, overall and within a group
-- SUM() OVER () with empty brackets is the grand total; adding PARTITION BY
-- makes it the total for each channel.
WITH sales AS (
    SELECT s.channel, p.major_product_group, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_store s   ON f.store_id = s.store_id
    JOIN dim_product p ON f.sku = p.sku
    JOIN dim_date d    ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY s.channel, p.major_product_group
)
SELECT
    channel, major_product_group,
    ROUND(net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(net_sales_gbp / SUM(net_sales_gbp) OVER (), 3)                     AS pct_of_company,
    ROUND(net_sales_gbp / SUM(net_sales_gbp) OVER (PARTITION BY channel), 3) AS pct_of_channel
FROM sales
ORDER BY channel, net_sales_gbp DESC;

-- ## 9. NTILE: split stores into quartiles
-- NTILE(4) deals the rows into four equal-sized groups by sales.
WITH store_sales AS (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    JOIN dim_store s ON f.store_id = s.store_id
    WHERE d.business_year = 2025 AND s.channel = 'Retail'
    GROUP BY f.store_id
)
SELECT
    quartile,
    COUNT(*)                        AS stores,
    ROUND(MIN(net_sales_gbp), 0)    AS lowest_gbp,
    ROUND(MAX(net_sales_gbp), 0)    AS highest_gbp,
    ROUND(SUM(net_sales_gbp), 0)    AS quartile_sales_gbp
FROM (SELECT *, NTILE(4) OVER (ORDER BY net_sales_gbp DESC) AS quartile FROM store_sales)
GROUP BY quartile
ORDER BY quartile;

-- ## 10. Pareto: how many styles make up 80% of sales?
-- A cumulative share window, then count the styles before it crosses 80%.
-- The Style Pareto Cumulative % measure in Power BI does the same job.
WITH style_sales AS (
    SELECT p.style_code, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_product p ON f.sku = p.sku
    JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY p.style_code
),
cumulative AS (
    SELECT
        style_code, net_sales_gbp,
        SUM(net_sales_gbp) OVER (ORDER BY net_sales_gbp DESC ROWS UNBOUNDED PRECEDING)
            / SUM(net_sales_gbp) OVER () AS cumulative_share
    FROM style_sales
)
SELECT
    COUNT(*) FILTER (WHERE cumulative_share <= 0.8) + 1 AS styles_making_80pct,
    COUNT(*)                                            AS total_styles,
    ROUND((COUNT(*) FILTER (WHERE cumulative_share <= 0.8) + 1) * 1.0 / COUNT(*), 3) AS share_of_styles
FROM cumulative;

-- ## 11. FIRST_VALUE: compare each store with the best in its market
WITH store_sales AS (
    SELECT s.store_name, s.market_name, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_store s ON f.store_id = s.store_id
    JOIN dim_date d  ON f.date = d.full_date
    WHERE d.business_year = 2025 AND s.channel = 'Retail'
    GROUP BY s.store_name, s.market_name
)
SELECT
    market_name, store_name,
    ROUND(net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(net_sales_gbp / FIRST_VALUE(net_sales_gbp) OVER (PARTITION BY market_name ORDER BY net_sales_gbp DESC), 3) AS vs_market_best
FROM store_sales
QUALIFY ROW_NUMBER() OVER (PARTITION BY market_name ORDER BY net_sales_gbp DESC) <= 3
ORDER BY market_name, net_sales_gbp DESC;