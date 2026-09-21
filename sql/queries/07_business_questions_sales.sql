-- 07 · Business questions: sales and trading
--
-- Each query here answers a question someone in the business would actually
-- ask, and is the SQL twin of something on a report page. The figures should
-- line up with the Power BI measures of the same name.
--
-- Business years run from March to February, so "2025" here is 1 Mar 2025 to
-- 28 Feb 2026. Use dim_date.business_year, not the calendar year.

-- ## 1. How are we doing this year, like for like against last year?
-- Only periods that have fully finished count, and last year is cut to the
-- same period numbers, so a part-finished period can't drag the comparison down.
-- (LFL = like for like.)
WITH latest AS (SELECT MAX(date) AS max_date FROM fact_sales),
completed AS (
    SELECT p.business_year, p.business_period_number
    FROM dim_period p CROSS JOIN latest l
    WHERE p.period_end_date <= l.max_date
),
current_year AS (SELECT MAX(business_year) AS yr FROM completed),
scope AS (
    SELECT c.business_year, c.business_period_number,
           CASE WHEN c.business_year = cy.yr THEN 'This year' ELSE 'Last year' END AS year_label
    FROM completed c
    JOIN current_year cy ON c.business_year IN (cy.yr, cy.yr - 1)
    WHERE c.business_period_number IN (SELECT business_period_number FROM completed WHERE business_year = cy.yr)
),
totals AS (
    SELECT
        sc.year_label,
        SUM(f.net_sales_gbp)                                           AS net_sales_gbp,
        SUM(f.quantity)                                                AS net_units,
        SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp)       AS gross_margin_pct
    FROM fact_sales f
    JOIN dim_date d  ON f.date = d.full_date
    JOIN scope sc    ON d.business_year = sc.business_year AND d.business_period_number = sc.business_period_number
    GROUP BY sc.year_label
)
SELECT
    year_label,
    ROUND(net_sales_gbp, 0)     AS net_sales_gbp,
    net_units,
    ROUND(gross_margin_pct, 4)  AS gross_margin_pct,
    ROUND(net_sales_gbp / LAG(net_sales_gbp) OVER (ORDER BY year_label) - 1, 4) AS sales_vs_ly
FROM totals
ORDER BY year_label DESC;
-- (Alphabetically 'Last year' sorts before 'This year', so LAG inside the window
-- looks back from this year to last year. The final ORDER BY only sets the display order.)

-- ## 2. What is the trend by period, and how does each compare with last year?
-- LAG(12) is the same period a year ago. Periods that haven't finished are left
-- out, otherwise the newest one shows a misleading drop.
WITH latest AS (SELECT MAX(date) AS max_date FROM fact_sales),
period_sales AS (
    SELECT d.period_key, d.business_period_label, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY d.period_key, d.business_period_label
),
with_ly AS (
    SELECT *, LAG(net_sales_gbp, 12) OVER (ORDER BY period_key) AS ly_gbp
    FROM period_sales
)
SELECT
    w.business_period_label,
    ROUND(w.net_sales_gbp, 0) AS net_sales_gbp,
    ROUND(w.ly_gbp, 0)        AS same_period_ly_gbp,
    ROUND(w.net_sales_gbp / w.ly_gbp - 1, 4) AS yoy_pct
FROM with_ly w
JOIN dim_period p ON w.period_key = p.period_key
CROSS JOIN latest l
WHERE p.period_end_date <= l.max_date
ORDER BY w.period_key DESC
LIMIT 13;

-- ## 3. Which channel drives sales, and is it growing?
-- Conditional aggregation turns years into columns (a hand-made pivot).
SELECT
    s.channel,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024), 0) AS sales_2024,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025), 0) AS sales_2025,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)
        / SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024) - 1, 4) AS yoy_pct,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)
        / SUM(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)) OVER (), 3) AS share_of_2025
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
GROUP BY s.channel
ORDER BY sales_2025 DESC;

-- ## 4. Which markets are biggest and which are growing fastest?
SELECT
    s.market_name,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025), 0) AS sales_2025,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025)
        / SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2024) - 1, 4) AS yoy_pct,
    RANK() OVER (ORDER BY SUM(f.net_sales_gbp) FILTER (WHERE d.business_year = 2025) DESC) AS size_rank
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year IN (2024, 2025)
GROUP BY s.market_name
ORDER BY sales_2025 DESC;

-- ## 5. Which day of the week is busiest?
-- Average sales per trading day, so a day that simply occurs more often
-- doesn't look bigger. (This is why the allocation curve in the Any-Grain
-- targets works: Saturday really is the peak.)
SELECT
    d.day_name,
    ROUND(SUM(f.net_sales_gbp) / COUNT(DISTINCT f.date), 0) AS avg_daily_sales_gbp,
    ROUND(SUM(f.net_sales_gbp) / SUM(SUM(f.net_sales_gbp)) OVER (), 3) AS share_of_sales
FROM fact_sales f
JOIN dim_date d ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY d.day_name, d.day_of_week_num
ORDER BY d.day_of_week_num;

-- ## 6. How profitable is each major product group?
SELECT
    p.division,
    p.major_product_group,
    ROUND(SUM(f.net_sales_gbp), 0)                                          AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp), 0)                             AS gross_profit_gbp,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp), 4)      AS gross_margin_pct
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.division, p.major_product_group
ORDER BY net_sales_gbp DESC;

-- ## 7. Where do we lose the most to returns?
-- Return rate = units returned / units sold before returns (the Return Rate %
-- measure). Returns are negative quantities, hence the minus sign.
SELECT
    p.major_product_group,
    SUM(f.quantity) FILTER (WHERE NOT f.is_return)  AS gross_units,
    -SUM(f.quantity) FILTER (WHERE f.is_return)     AS units_returned,
    ROUND(-SUM(f.quantity) FILTER (WHERE f.is_return)
        / SUM(f.quantity) FILTER (WHERE NOT f.is_return), 4) AS return_rate
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.major_product_group
ORDER BY return_rate DESC;

-- ## 8. What does a typical basket look like in each channel?
-- Returns are left out so they don't count as "baskets".
SELECT
    s.channel,
    COUNT(DISTINCT f.invoice_id)                                        AS invoices,
    ROUND(SUM(f.net_sales_gbp) / COUNT(DISTINCT f.invoice_id), 2)       AS avg_invoice_value_gbp,
    ROUND(SUM(f.quantity) * 1.0 / COUNT(DISTINCT f.invoice_id), 2)      AS units_per_invoice
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025 AND NOT f.is_return
GROUP BY s.channel
ORDER BY invoices DESC;

-- ## 9. How much of each channel's sales happen at the weekend?
SELECT
    s.channel,
    ROUND(SUM(f.net_sales_gbp) FILTER (WHERE d.is_weekend) / SUM(f.net_sales_gbp), 3) AS weekend_share,
    ROUND(2.0 / 7, 3) AS weekend_share_if_every_day_equal
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY s.channel
ORDER BY weekend_share DESC;

-- ## 10. Which business periods are strongest? A seasonality index
-- 1.00 is an average period, 1.25 means 25% above average. Two complete
-- years are averaged so one odd year doesn't set the pattern.
WITH period_sales AS (
    SELECT d.business_year, d.business_period_number, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year IN (2024, 2025)
    GROUP BY d.business_year, d.business_period_number
),
by_period AS (
    SELECT business_period_number, AVG(net_sales_gbp) AS avg_sales_gbp
    FROM period_sales GROUP BY business_period_number
)
SELECT
    business_period_number,
    ROUND(avg_sales_gbp, 0) AS avg_sales_gbp,
    ROUND(avg_sales_gbp / AVG(avg_sales_gbp) OVER (), 2) AS seasonality_index
FROM by_period
ORDER BY business_period_number;