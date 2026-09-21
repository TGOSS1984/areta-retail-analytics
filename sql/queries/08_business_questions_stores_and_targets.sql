-- 08 · Business questions: stores, footfall and targets
--
-- Targets live in fact_targets at store x business period grain. Comparing
-- them with actuals means summing sales to that same grain first, then joining.
-- These are the questions behind the Retail page and the vs-Target lines on
-- the KPI cards.

-- ## 1. Are we hitting target? Sales against target by market, business year 2025
WITH actuals AS (
    SELECT f.store_id, d.period_key, SUM(f.net_sales_gbp) AS actual_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id, d.period_key
)
SELECT
    s.market_name,
    ROUND(SUM(a.actual_gbp), 0)                   AS actual_gbp,
    ROUND(SUM(t.target_net_sales_gbp), 0)         AS target_gbp,
    ROUND(SUM(a.actual_gbp) / SUM(t.target_net_sales_gbp), 4)     AS achievement,
    ROUND(SUM(a.actual_gbp) - SUM(t.target_net_sales_gbp), 0)     AS variance_gbp
FROM fact_targets t
JOIN dim_store s ON t.store_id = s.store_id
LEFT JOIN actuals a ON a.store_id = t.store_id AND a.period_key = t.period_key
WHERE t.business_year = 2025
GROUP BY s.market_name
ORDER BY achievement DESC;

-- ## 2. Which stores are furthest behind target this year so far?
-- Only finished periods of the current business year are compared, otherwise
-- every store looks behind because part of the year hasn't happened.
WITH latest AS (SELECT MAX(date) AS max_date FROM fact_sales),
done AS (
    SELECT p.period_key
    FROM dim_period p CROSS JOIN latest l
    WHERE p.period_end_date <= l.max_date
      AND p.business_year = (SELECT MAX(business_year) FROM dim_period q, latest l2 WHERE q.period_end_date <= l2.max_date)
),
actuals AS (
    SELECT f.store_id, d.period_key, SUM(f.net_sales_gbp) AS actual_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.period_key IN (SELECT period_key FROM done)
    GROUP BY f.store_id, d.period_key
)
SELECT
    s.store_name, s.market_name, s.channel,
    ROUND(SUM(a.actual_gbp), 0)                                AS actual_gbp,
    ROUND(SUM(t.target_net_sales_gbp), 0)                      AS target_gbp,
    ROUND(SUM(a.actual_gbp) / SUM(t.target_net_sales_gbp), 3)  AS achievement
FROM fact_targets t
JOIN dim_store s ON t.store_id = s.store_id
LEFT JOIN actuals a ON a.store_id = t.store_id AND a.period_key = t.period_key
WHERE t.period_key IN (SELECT period_key FROM done)
GROUP BY s.store_name, s.market_name, s.channel
HAVING SUM(t.target_net_sales_gbp) > 0
ORDER BY achievement ASC
LIMIT 10;

-- ## 3. Store league table: sales, footfall and conversion side by side
-- Each fact is summed to one row per store BEFORE the join, so nothing fans
-- out (the trap in 04_joins.sql, query 5).
WITH sales AS (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp,
           COUNT(DISTINCT f.invoice_id) FILTER (WHERE NOT f.is_return) AS invoices
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id
),
traffic AS (
    SELECT ff.store_id, SUM(ff.footfall) AS footfall, SUM(ff.transactions) AS transactions
    FROM fact_footfall ff JOIN dim_date d ON ff.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY ff.store_id
)
SELECT
    s.store_name, s.market_name, s.store_type,
    ROUND(sa.net_sales_gbp, 0)                          AS net_sales_gbp,
    tr.footfall,
    ROUND(tr.transactions * 1.0 / tr.footfall, 4)       AS conversion_rate,
    ROUND(sa.net_sales_gbp / tr.transactions, 2)        AS avg_transaction_value_gbp
FROM sales sa
JOIN traffic tr ON sa.store_id = tr.store_id
JOIN dim_store s ON sa.store_id = s.store_id
ORDER BY sa.net_sales_gbp DESC
LIMIT 15;

-- ## 4. Footfall and conversion by store type and year
SELECT
    s.store_type,
    d.business_year,
    SUM(ff.footfall)                                     AS footfall,
    ROUND(SUM(ff.transactions) * 1.0 / SUM(ff.footfall), 4) AS conversion_rate
FROM fact_footfall ff
JOIN dim_store s ON ff.store_id = s.store_id
JOIN dim_date d  ON ff.date = d.full_date
WHERE d.business_year IN (2024, 2025)
GROUP BY s.store_type, d.business_year
ORDER BY s.store_type, d.business_year;

-- ## 5. Does conversion change by day of the week?
SELECT
    d.day_name,
    SUM(ff.footfall)                                        AS footfall,
    ROUND(SUM(ff.transactions) * 1.0 / SUM(ff.footfall), 4) AS conversion_rate
FROM fact_footfall ff
JOIN dim_date d ON ff.date = d.full_date
WHERE d.business_year = 2025
GROUP BY d.day_name, d.day_of_week_num
ORDER BY d.day_of_week_num;

-- ## 6. Footfall against target by market
SELECT
    s.market_name,
    SUM(ff.footfall)                          AS actual_footfall,
    ROUND(SUM(t.target_footfall), 0)          AS target_footfall,
    ROUND(SUM(ff.footfall) / SUM(t.target_footfall), 4) AS achievement
FROM (
    SELECT store_id, d.period_key, SUM(footfall) AS footfall
    FROM fact_footfall f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY store_id, d.period_key
) ff
JOIN fact_targets t ON t.store_id = ff.store_id AND t.period_key = ff.period_key
JOIN dim_store s    ON s.store_id = ff.store_id
GROUP BY s.market_name
ORDER BY achievement DESC;

-- ## 7. Which stores lost more than 5% of their sales year on year?
-- HAVING filters on the ratio of two conditional sums.
SELECT
    s.store_name, s.market_name,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024), 0) AS sales_2024,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025), 0) AS sales_2025,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)
        / SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024) - 1, 3) AS yoy_pct
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year IN (2024, 2025) AND s.channel = 'Retail'
GROUP BY s.store_name, s.market_name
HAVING SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)
     / SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024) - 1 < -0.05
ORDER BY yoy_pct
LIMIT 15;

-- ## 8. Home markets against the rest
SELECT
    s.is_home_market,
    COUNT(DISTINCT s.store_id)                              AS stores,
    ROUND(SUM(f.net_sales_gbp), 0)                          AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp) / COUNT(DISTINCT s.store_id), 0) AS sales_per_store_gbp,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp), 4) AS gross_margin_pct
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025 AND s.channel <> 'Online'
GROUP BY s.is_home_market;

-- ## 9. The best three stores in every market
-- ROW_NUMBER inside QUALIFY keeps three rows per market.
SELECT
    s.market_name, s.store_name,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025 AND s.channel = 'Retail'
GROUP BY s.market_name, s.store_name
QUALIFY ROW_NUMBER() OVER (PARTITION BY s.market_name ORDER BY SUM(f.net_sales_gbp) DESC) <= 3
ORDER BY s.market_name, net_sales_gbp DESC;

-- ## 10. Sales density: pounds per visitor by region
SELECT
    s.region,
    ROUND(SUM(sa.net_sales_gbp), 0)                AS net_sales_gbp,
    SUM(tr.footfall)                               AS footfall,
    ROUND(SUM(sa.net_sales_gbp) / SUM(tr.footfall), 2) AS sales_per_visitor_gbp
FROM (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY f.store_id
) sa
JOIN (
    SELECT ff.store_id, SUM(ff.footfall) AS footfall
    FROM fact_footfall ff JOIN dim_date d ON ff.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY ff.store_id
) tr ON sa.store_id = tr.store_id
JOIN dim_store s ON sa.store_id = s.store_id
GROUP BY s.region
ORDER BY sales_per_visitor_gbp DESC
LIMIT 12;