-- 10 · Business questions: digital and finance
--
-- The Digital and Finance pages. Digital sales are keyed by market and device
-- (no stores), and the store P&L is per store per business period.

-- ## 1. How is the website doing by market and device?
-- Average basket = sales / orders, the Average Basket Value measure.
SELECT
    ds.market_code,
    ds.device_type,
    SUM(ds.orders)                                     AS orders,
    ROUND(SUM(ds.net_sales_gbp), 0)                    AS net_sales_gbp,
    ROUND(SUM(ds.net_sales_gbp) / SUM(ds.orders), 2)   AS avg_basket_gbp,
    ROUND(SUM(ds.units) * 1.0 / SUM(ds.orders), 2)     AS units_per_order
FROM fact_digital_sales ds
JOIN dim_date d ON ds.date = d.full_date
WHERE d.business_year = 2025
GROUP BY ds.market_code, ds.device_type
ORDER BY net_sales_gbp DESC
LIMIT 12;

-- ## 2. Conversion rate by market
-- Orders come from one table, sessions from another. Each is summed to market
-- level first and only then joined, so neither can multiply the other.
WITH orders AS (
    SELECT ds.market_code, SUM(ds.orders) AS orders
    FROM fact_digital_sales ds JOIN dim_date d ON ds.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY ds.market_code
),
sessions AS (
    SELECT dt.market_code, SUM(dt.sessions) AS sessions, SUM(dt.visitors) AS visitors
    FROM fact_digital_traffic dt JOIN dim_date d ON dt.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY dt.market_code
)
SELECT
    o.market_code, o.orders, s.sessions,
    ROUND(o.orders * 1.0 / s.sessions, 4) AS conversion_rate
FROM orders o
JOIN sessions s ON o.market_code = s.market_code
ORDER BY conversion_rate DESC;

-- ## 3. The funnel: visitors to sessions to orders, by device
SELECT
    t.device_type,
    t.visitors,
    t.sessions,
    o.orders,
    ROUND(t.sessions * 1.0 / t.visitors, 2) AS sessions_per_visitor,
    ROUND(o.orders * 1.0 / t.sessions, 4)   AS conversion_rate
FROM (
    SELECT dt.device_type, SUM(dt.visitors) AS visitors, SUM(dt.sessions) AS sessions
    FROM fact_digital_traffic dt JOIN dim_date d ON dt.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY dt.device_type
) t
JOIN (
    SELECT ds.device_type, SUM(ds.orders) AS orders
    FROM fact_digital_sales ds JOIN dim_date d ON ds.date = d.full_date
    WHERE d.business_year = 2025 GROUP BY ds.device_type
) o ON t.device_type = o.device_type
ORDER BY t.sessions DESC;

-- ## 4. Browser share of sessions, and how engaged each browser is
SELECT
    browser,
    SUM(sessions)                                        AS sessions,
    ROUND(SUM(sessions) * 1.0 / SUM(SUM(sessions)) OVER (), 3) AS share_of_sessions,
    ROUND(SUM(page_views) * 1.0 / SUM(sessions), 2)      AS pages_per_session
FROM fact_digital_traffic dt
JOIN dim_date d ON dt.date = d.full_date
WHERE d.business_year = 2025
GROUP BY browser
ORDER BY sessions DESC;

-- ## 5. Digital sales against target, by market
-- Targets are per market per period, so digital sales are summed to the same
-- grain (period) before comparing.
WITH actuals AS (
    SELECT ds.market_code, d.period_key, SUM(ds.net_sales_gbp) AS actual_gbp
    FROM fact_digital_sales ds JOIN dim_date d ON ds.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY ds.market_code, d.period_key
)
SELECT
    t.market_code,
    ROUND(SUM(a.actual_gbp), 0)                              AS actual_gbp,
    ROUND(SUM(t.target_digital_net_sales_gbp), 0)            AS target_gbp,
    ROUND(SUM(a.actual_gbp) / SUM(t.target_digital_net_sales_gbp), 4) AS achievement
FROM fact_digital_targets t
LEFT JOIN actuals a ON a.market_code = t.market_code AND a.period_key = t.period_key
WHERE t.business_year = 2025
GROUP BY t.market_code
ORDER BY achievement DESC;

-- ## 6. Weekly digital sales with a four-week moving average
WITH weekly AS (
    SELECT d.business_year, d.business_week_number, MIN(d.full_date) AS week_start,
           SUM(ds.net_sales_gbp) AS net_sales_gbp
    FROM fact_digital_sales ds JOIN dim_date d ON ds.date = d.full_date
    GROUP BY d.business_year, d.business_week_number
)
SELECT
    week_start,
    ROUND(net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(AVG(net_sales_gbp) OVER (ORDER BY week_start ROWS BETWEEN 3 PRECEDING AND CURRENT ROW), 0) AS moving_avg_4_weeks
FROM weekly
ORDER BY week_start DESC
LIMIT 12;

-- ## 7. The company P&L by business year
-- fact_store_finance has one row per store per period, so a straight SUM gives
-- the P&L. Net contribution % is the ratio of the two SUMs, not an average of
-- store percentages. Online has no store P&L, so it isn't in here.
SELECT
    business_year,
    ROUND(SUM(net_sales_gbp), 0)            AS net_sales_gbp,
    ROUND(SUM(gross_profit_gbp), 0)         AS gross_profit_gbp,
    ROUND(SUM(rent_gbp + staff_gbp + utilities_gbp + marketing_gbp), 0) AS store_running_costs_gbp,
    ROUND(SUM(gross_contribution_gbp), 0)   AS gross_contribution_gbp,
    ROUND(SUM(head_office_gbp), 0)          AS head_office_gbp,
    ROUND(SUM(net_contribution_gbp), 0)     AS net_contribution_gbp,
    ROUND(SUM(net_contribution_gbp) / SUM(net_sales_gbp), 4) AS net_contribution_pct
FROM fact_store_finance
GROUP BY business_year
ORDER BY business_year;

-- ## 8. Which markets are the most profitable?
SELECT
    s.market_name,
    ROUND(SUM(fin.net_sales_gbp), 0)        AS net_sales_gbp,
    ROUND(SUM(fin.net_contribution_gbp), 0) AS net_contribution_gbp,
    ROUND(SUM(fin.net_contribution_gbp) / SUM(fin.net_sales_gbp), 4) AS net_contribution_pct
FROM fact_store_finance fin
JOIN dim_store s ON fin.store_id = s.store_id
WHERE fin.business_year = 2025
GROUP BY s.market_name
ORDER BY net_contribution_pct DESC;

-- ## 9. The ten least profitable stores, and how they rank in their market
-- Two windows in one query: RANK across the company and within the market.
WITH store_pnl AS (
    SELECT
        s.store_name, s.market_name,
        SUM(fin.net_sales_gbp)        AS net_sales_gbp,
        SUM(fin.net_contribution_gbp) AS net_contribution_gbp
    FROM fact_store_finance fin
    JOIN dim_store s ON fin.store_id = s.store_id
    WHERE fin.business_year = 2025
    GROUP BY s.store_name, s.market_name
)
SELECT
    store_name, market_name,
    ROUND(net_sales_gbp, 0)                                AS net_sales_gbp,
    ROUND(net_contribution_gbp, 0)                         AS net_contribution_gbp,
    ROUND(net_contribution_gbp / net_sales_gbp, 4)         AS net_contribution_pct,
    RANK() OVER (ORDER BY net_contribution_gbp / net_sales_gbp)                            AS company_rank_from_bottom,
    RANK() OVER (PARTITION BY market_name ORDER BY net_contribution_gbp / net_sales_gbp)   AS market_rank_from_bottom
FROM store_pnl
ORDER BY net_contribution_gbp / net_sales_gbp
LIMIT 10;

-- ## 10. Where does each pound of sales go? Cost lines by store type
SELECT
    s.store_type,
    ROUND(SUM(fin.cogs_gbp) / SUM(fin.net_sales_gbp), 3)        AS cogs_pct,
    ROUND(SUM(fin.rent_gbp) / SUM(fin.net_sales_gbp), 3)        AS rent_pct,
    ROUND(SUM(fin.staff_gbp) / SUM(fin.net_sales_gbp), 3)       AS staff_pct,
    ROUND(SUM(fin.utilities_gbp) / SUM(fin.net_sales_gbp), 3)   AS utilities_pct,
    ROUND(SUM(fin.marketing_gbp) / SUM(fin.net_sales_gbp), 3)   AS marketing_pct,
    ROUND(SUM(fin.head_office_gbp) / SUM(fin.net_sales_gbp), 3) AS head_office_pct,
    ROUND(SUM(fin.net_contribution_gbp) / SUM(fin.net_sales_gbp), 3) AS net_contribution_pct
FROM fact_store_finance fin
JOIN dim_store s ON fin.store_id = s.store_id
WHERE fin.business_year = 2025
GROUP BY s.store_type
ORDER BY net_contribution_pct DESC;

-- ## 11. Net contribution against target by market
SELECT
    s.market_name,
    ROUND(SUM(fin.net_contribution_gbp), 0)        AS actual_gbp,
    ROUND(SUM(t.target_net_contribution_gbp), 0)   AS target_gbp,
    ROUND(SUM(fin.net_contribution_gbp) / SUM(t.target_net_contribution_gbp), 3) AS achievement
FROM fact_store_finance fin
JOIN fact_targets t ON t.store_id = fin.store_id AND t.period_key = fin.period_key
JOIN dim_store s    ON s.store_id = fin.store_id
WHERE fin.business_year = 2025
GROUP BY s.market_name
ORDER BY achievement DESC;