-- Solutions to practice/exercises.md
--
-- Try each exercise yourself first. There's usually more than one right way to
-- write a query, so if yours returns the same rows it's right, even if it
-- looks different from this.
--
-- Run one:  python sql/duck.py run sql/practice/solutions.sql --only 3.2

-- ## 1.1 Every store in Germany
SELECT store_name, city
FROM dim_store
WHERE market_code = 'DE'
ORDER BY store_name;

-- ## 1.2 How many SKUs and how many styles?
SELECT COUNT(*) AS skus, COUNT(DISTINCT style_code) AS styles
FROM dim_product;

-- ## 1.3 Kestrel Ridge products over £150
SELECT sku, style_name, base_price_gbp
FROM dim_product
WHERE brand_name = 'Kestrel Ridge' AND base_price_gbp > 150
ORDER BY base_price_gbp DESC;

-- ## 1.4 Clearance promotions and their discounts
SELECT promo_name, discount_pct, start_date
FROM dim_promo
WHERE promo_type = 'Clearance'
ORDER BY start_date;

-- ## 1.5 Christmas Day and Boxing Day dates
SELECT full_date, day_name
FROM dim_date
WHERE is_christmas_day OR is_boxing_day
ORDER BY full_date;

-- ## 1.6 Net sales and units in calendar 2024
SELECT ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp, SUM(quantity) AS net_units
FROM fact_sales
WHERE date >= DATE '2024-01-01' AND date < DATE '2025-01-01';

-- ## 2.1 Net sales by calendar year
SELECT EXTRACT(year FROM date) AS calendar_year, ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales
GROUP BY calendar_year
ORDER BY calendar_year;

-- ## 2.2 Sale lines against return lines
SELECT is_return, COUNT(*) AS lines, ROUND(COUNT(*) * 1.0 / SUM(COUNT(*)) OVER (), 4) AS share_of_lines
FROM fact_sales
GROUP BY is_return;

-- ## 2.3 Average unit price for the five most-used promo codes
SELECT promo_id, COUNT(*) AS lines, ROUND(AVG(unit_price_gbp), 2) AS avg_unit_price_gbp
FROM fact_sales
GROUP BY promo_id
ORDER BY lines DESC
LIMIT 5;

-- ## 2.4 Stores with more than 20,000 sales lines in 2025
SELECT store_id, COUNT(*) AS lines
FROM fact_sales
WHERE date >= DATE '2025-01-01' AND date < DATE '2026-01-01'
GROUP BY store_id
HAVING COUNT(*) > 20000
ORDER BY lines DESC;

-- ## 2.5 Company gross margin percentage
SELECT ROUND(SUM(net_sales_gbp - cost_gbp) / SUM(net_sales_gbp), 4) AS gross_margin_pct
FROM fact_sales;

-- ## 2.6 Footfall, transactions and conversion by calendar year
SELECT
    EXTRACT(year FROM date) AS calendar_year,
    SUM(footfall)           AS footfall,
    SUM(transactions)       AS transactions,
    ROUND(SUM(transactions) * 1.0 / SUM(footfall), 4) AS conversion_rate
FROM fact_footfall
GROUP BY calendar_year
ORDER BY calendar_year;

-- ## 3.1 Net sales by market for business year 2025
SELECT s.market_name, ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY s.market_name
ORDER BY net_sales_gbp DESC;

-- ## 3.2 Net sales and gross margin percentage by brand, business year 2025
SELECT
    p.brand_name,
    ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp,
    ROUND(SUM(f.net_sales_gbp - f.cost_gbp) / SUM(f.net_sales_gbp), 4) AS gross_margin_pct
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.brand_name
ORDER BY net_sales_gbp DESC;

-- ## 3.3 Top five Irish stores by net sales, business year 2025
SELECT s.store_name, ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025 AND s.market_name = 'Ireland'
GROUP BY s.store_name
ORDER BY net_sales_gbp DESC
LIMIT 5;

-- ## 3.4 SKUs that have never been sold
SELECT p.sku, p.style_name, p.product_group
FROM dim_product p
LEFT JOIN fact_sales f ON p.sku = f.sku
WHERE f.sku IS NULL
ORDER BY p.sku;

-- ## 3.5 Average invoice value by channel, business year 2025
SELECT
    s.channel,
    ROUND(SUM(f.net_sales_gbp) / COUNT(DISTINCT f.invoice_id), 2) AS avg_invoice_value_gbp
FROM fact_sales f
JOIN dim_store s ON f.store_id = s.store_id
JOIN dim_date d  ON f.date = d.full_date
WHERE d.business_year = 2025 AND NOT f.is_return
GROUP BY s.channel
ORDER BY avg_invoice_value_gbp DESC;

-- ## 3.6 Footfall by store type, business year 2025
SELECT s.store_type, SUM(ff.footfall) AS footfall
FROM fact_footfall ff
JOIN dim_store s ON ff.store_id = s.store_id
JOIN dim_date d  ON ff.date = d.full_date
WHERE d.business_year = 2025
GROUP BY s.store_type
ORDER BY footfall DESC;

-- ## 4.1 The five best-selling styles in each brand, business year 2025
SELECT p.brand_name, p.style_name, ROUND(SUM(f.net_sales_gbp), 0) AS net_sales_gbp
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
JOIN dim_date d    ON f.date = d.full_date
WHERE d.business_year = 2025
GROUP BY p.brand_name, p.style_name, p.style_code
QUALIFY RANK() OVER (PARTITION BY p.brand_name ORDER BY SUM(f.net_sales_gbp) DESC) <= 5
ORDER BY p.brand_name, net_sales_gbp DESC;

-- ## 4.2 Running total of net sales through business year 2025
WITH period_sales AS (
    SELECT d.business_period_number AS period, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY d.business_period_number
)
SELECT period, ROUND(net_sales_gbp, 0) AS net_sales_gbp,
       ROUND(SUM(net_sales_gbp) OVER (ORDER BY period), 0) AS running_total_gbp
FROM period_sales
ORDER BY period;

-- ## 4.3 Year-on-year change for each business period of 2025
WITH period_sales AS (
    SELECT d.period_key, d.business_year, d.business_period_label, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY d.period_key, d.business_year, d.business_period_label
),
with_ly AS (
    SELECT *, LAG(net_sales_gbp, 12) OVER (ORDER BY period_key) AS ly_gbp FROM period_sales
)
SELECT business_period_label, ROUND(net_sales_gbp, 0) AS net_sales_gbp, ROUND(ly_gbp, 0) AS ly_gbp,
       ROUND(net_sales_gbp / ly_gbp - 1, 4) AS yoy_pct
FROM with_ly
WHERE business_year = 2025
ORDER BY period_key;

-- ## 4.4 What share of 2025 net sales came from the top 10% of stores?
WITH store_sales AS (
    SELECT f.store_id, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id
),
tiled AS (
    SELECT *, NTILE(10) OVER (ORDER BY net_sales_gbp DESC) AS decile FROM store_sales
)
SELECT
    COUNT(*) AS stores_in_top_decile,
    ROUND(SUM(net_sales_gbp) / (SELECT SUM(net_sales_gbp) FROM store_sales), 3) AS share_of_sales
FROM tiled
WHERE decile = 1;

-- ## 4.5 Retail stores that beat the average of their own market, business year 2025
WITH store_sales AS (
    SELECT s.store_name, s.market_name, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f
    JOIN dim_store s ON f.store_id = s.store_id
    JOIN dim_date d  ON f.date = d.full_date
    WHERE d.business_year = 2025 AND s.channel = 'Retail'
    GROUP BY s.store_name, s.market_name
)
SELECT market_name, store_name, ROUND(net_sales_gbp, 0) AS net_sales_gbp
FROM store_sales
QUALIFY net_sales_gbp > AVG(net_sales_gbp) OVER (PARTITION BY market_name)
ORDER BY market_name, net_sales_gbp DESC;

-- ## 4.6 Weekly net sales with a 4-week moving average, latest 10 weeks
WITH weekly AS (
    SELECT MIN(d.full_date) AS week_start, SUM(f.net_sales_gbp) AS net_sales_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    GROUP BY d.business_year, d.business_week_number
)
SELECT week_start, ROUND(net_sales_gbp, 0) AS net_sales_gbp,
       ROUND(AVG(net_sales_gbp) OVER (ORDER BY week_start ROWS BETWEEN 3 PRECEDING AND CURRENT ROW), 0) AS moving_avg_4_weeks
FROM weekly
ORDER BY week_start DESC
LIMIT 10;

-- ## 5.1 Sales against target by store type, business year 2025
WITH actuals AS (
    SELECT f.store_id, d.period_key, SUM(f.net_sales_gbp) AS actual_gbp
    FROM fact_sales f JOIN dim_date d ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY f.store_id, d.period_key
)
SELECT
    s.store_type,
    ROUND(SUM(a.actual_gbp), 0) AS actual_gbp,
    ROUND(SUM(t.target_net_sales_gbp), 0) AS target_gbp,
    ROUND(SUM(a.actual_gbp) / SUM(t.target_net_sales_gbp), 4) AS achievement
FROM fact_targets t
JOIN dim_store s ON t.store_id = s.store_id
LEFT JOIN actuals a ON a.store_id = t.store_id AND a.period_key = t.period_key
WHERE t.business_year = 2025
GROUP BY s.store_type
ORDER BY achievement DESC;

-- ## 5.2 Weeks of cover for each major product group at the latest snapshot
WITH snapshot AS (SELECT MAX(week_ending_date) AS as_of FROM fact_stock_snapshot),
stock AS (
    SELECT major_product_group, SUM(stock_units) AS stock_units
    FROM fact_stock_snapshot, snapshot
    WHERE week_ending_date = snapshot.as_of
    GROUP BY major_product_group
),
sales AS (
    SELECT p.major_product_group, SUM(f.quantity) / 4.0 AS avg_weekly_units
    FROM fact_sales f JOIN dim_product p ON f.sku = p.sku, snapshot
    WHERE NOT f.is_return AND f.date > snapshot.as_of - 28 AND f.date <= snapshot.as_of
    GROUP BY p.major_product_group
)
SELECT st.major_product_group, st.stock_units, ROUND(st.stock_units / sa.avg_weekly_units, 1) AS weeks_of_cover
FROM stock st JOIN sales sa USING (major_product_group)
ORDER BY weeks_of_cover DESC;

-- ## 5.3 Net contribution % by market for 2025, flagged against the company figure
WITH company AS (
    SELECT SUM(net_contribution_gbp) / SUM(net_sales_gbp) AS company_pct
    FROM fact_store_finance WHERE business_year = 2025
)
SELECT
    s.market_name,
    ROUND(SUM(fin.net_contribution_gbp) / SUM(fin.net_sales_gbp), 4) AS net_contribution_pct,
    CASE WHEN SUM(fin.net_contribution_gbp) / SUM(fin.net_sales_gbp) < c.company_pct
         THEN 'Below company' ELSE 'At or above company' END AS flag
FROM fact_store_finance fin
JOIN dim_store s ON fin.store_id = s.store_id
CROSS JOIN company c
WHERE fin.business_year = 2025
GROUP BY s.market_name, c.company_pct
ORDER BY net_contribution_pct;

-- ## 5.4 The five best sales days in calendar 2025, and the promotion running
WITH daily AS (
    SELECT date, SUM(net_sales_gbp) AS net_sales_gbp
    FROM fact_sales
    WHERE date >= DATE '2025-01-01' AND date < DATE '2026-01-01'
    GROUP BY date
)
SELECT
    dl.date, d.day_name, ROUND(dl.net_sales_gbp, 0) AS net_sales_gbp,
    COALESCE(pr.promo_name, 'No promotion') AS promotion
FROM daily dl
JOIN dim_date d ON dl.date = d.full_date
LEFT JOIN dim_promo pr ON dl.date BETWEEN pr.start_date AND pr.end_date
ORDER BY dl.net_sales_gbp DESC
LIMIT 5;

-- ## 5.5 Digital sales as a share of each market's total, business year 2025
WITH digital AS (
    SELECT ds.market_code, SUM(ds.net_sales_gbp) AS digital_gbp
    FROM fact_digital_sales ds JOIN dim_date d ON ds.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY ds.market_code
),
total AS (
    SELECT s.market_code, SUM(f.net_sales_gbp) AS total_gbp
    FROM fact_sales f
    JOIN dim_store s ON f.store_id = s.store_id
    JOIN dim_date d  ON f.date = d.full_date
    WHERE d.business_year = 2025
    GROUP BY s.market_code
)
SELECT t.market_code, ROUND(t.total_gbp, 0) AS total_gbp, ROUND(dg.digital_gbp, 0) AS digital_gbp,
       ROUND(dg.digital_gbp / t.total_gbp, 3) AS digital_share
FROM total t
JOIN digital dg ON t.market_code = dg.market_code
ORDER BY digital_share DESC;

-- ## 5.6 A sample answer to the design-your-own exercise: which brand has the highest return rate?
SELECT
    p.brand_name,
    ROUND(-SUM(f.quantity) FILTER (WHERE f.is_return) / SUM(f.quantity) FILTER (WHERE NOT f.is_return), 4) AS return_rate
FROM fact_sales f
JOIN dim_product p ON f.sku = p.sku
GROUP BY p.brand_name
ORDER BY return_rate DESC;