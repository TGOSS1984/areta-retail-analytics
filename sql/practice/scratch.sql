-- Scratch pad
--
-- Nothing here is checked or graded. Write whatever you like, run it, break it.
--
--   python sql/duck.py run sql/practice/scratch.sql
--   python sql/duck.py ui        (notebook in the browser, better for exploring)
--   python sql/duck.py shell     (a prompt in the terminal)
--
-- Every query needs a "-- ##" title line above it to be picked up by `run`.
-- Tables you can use: dim_date, dim_store, dim_product, dim_promo, dim_period,
-- fact_sales, fact_footfall, fact_stock_snapshot, fact_store_finance,
-- fact_targets, fact_digital_sales, fact_digital_traffic, fact_digital_targets,
-- plus v_sales_flat (fact_sales already joined to everything) to start on.

-- ## My first query
SELECT *
FROM v_sales_flat
LIMIT 10;

-- ## Try changing this one: which product groups sell best on Saturdays?
SELECT product_group, ROUND(SUM(net_sales_gbp), 0) AS net_sales_gbp
FROM v_sales_flat
WHERE day_name = 'Saturday'
GROUP BY product_group
ORDER BY net_sales_gbp DESC
LIMIT 10;