# SQL practice exercises

Thirty questions on the real warehouse, easy to hard. Work through them in order, or jump to the level you're at.

**How to use these**

1. Read the question, open `practice/scratch.sql` (or `python sql/duck.py ui`) and write your own query.
2. Compare with the **Check** line. If yours returns something similar, you're on track.
3. Stuck? Read the **Hint**. Still stuck? Peek at the answer with
   `python sql/duck.py run sql/practice/solutions.sql --only 3.2`
   (swap in the exercise number), then close it and write it again from memory.

There's more than one right way to write most of these. If your rows match the check, your query is fine, even when it looks different from the solution.

**About the numbers:** the warehouse is generated fresh each time the pipeline runs, so figures move by a fraction of a percent between builds. The checks say "about" wherever that matters. Row counts and anything from the dimension tables are stable.

Tables: `dim_date`, `dim_store`, `dim_product`, `dim_promo`, `dim_period`, `fact_sales`, `fact_footfall`, `fact_stock_snapshot`, `fact_store_finance`, `fact_targets`, `fact_digital_sales`, `fact_digital_traffic`, `fact_digital_targets`. Run `python sql/duck.py schema` to see every column. Business years run March to February, so use `dim_date.business_year` when a question says "business year".

---

## Level 1: SELECT, WHERE, ORDER BY

**1.1** List every store in Germany (`market_code = 'DE'`) with its name and city, in alphabetical order of name.
*Hint:* `dim_store`, a WHERE, an ORDER BY.
*Check:* 53 rows.

**1.2** How many SKUs are in the product dimension, and how many distinct styles?
*Hint:* `COUNT(*)` and `COUNT(DISTINCT ...)` in one SELECT.
*Check:* 12,151 SKUs and 907 styles.

**1.3** Show every Kestrel Ridge SKU with a base price over £150: SKU, style name and price, most expensive first.
*Check:* 251 rows, the dearest just over £213.

**1.4** Which promotions are of type `Clearance`? Show the name, discount and start date, oldest first.
*Check:* 8 rows, starting with January Clearance 2023 at 70%.

**1.5** Which dates in `dim_date` are Christmas Day or Boxing Day?
*Hint:* they're true/false columns, and you need OR.
*Check:* 8 rows.

**1.6** What were the total net sales and net units in calendar 2024 (1 Jan to 31 Dec)?
*Hint:* filter `fact_sales.date` with a start date and an end date.
*Check:* about £38.9m and 1.07m units.

## Level 2: Aggregation

**2.1** Net sales by calendar year.
*Hint:* `EXTRACT(year FROM date)`.
*Check:* 4 rows. 2024 is about £38.9m. 2023 starts in March and 2026 is unfinished, so both are smaller.

**2.2** How many sales lines are returns and how many aren't, and what share of all lines is each?
*Hint:* `SUM(COUNT(*)) OVER ()` gives the total for the share.
*Check:* 2 rows. About 97% are sales, 3% returns.

**2.3** What are the five most-used promo codes on sales lines, and what's the average unit price under each?
*Check:* 5 rows. `PROMO0000` (full price) is far ahead of the rest.

**2.4** Which stores had more than 20,000 sales lines in calendar 2025?
*Hint:* HAVING.
*Check:* about 3 stores, the busiest with around 26,800 lines.

**2.5** What's the company's overall gross margin percentage?
*Hint:* gross profit is `net_sales_gbp - cost_gbp`. Sum first, then divide.
*Check:* about 69.5%.

**2.6** Footfall, transactions and conversion rate (transactions / footfall) for each calendar year.
*Check:* 4 rows. Conversion is around 17 to 18%.

## Level 3: Joins

**3.1** Net sales by market for business year 2025, biggest first.
*Hint:* `fact_sales` to `dim_store` and to `dim_date`.
*Check:* 11 rows. The United Kingdom leads at about £14.9m.

**3.2** Net sales and gross margin percentage by brand for business year 2025.
*Check:* 4 brands. Areta is first at about £13.4m, with a margin around 69.5%.

**3.3** The top five stores in Ireland by net sales for business year 2025.
*Hint:* the online site counts as a store here.
*Check:* 5 rows. The Ireland online store is first, at about £0.9m.

**3.4** Which SKUs have never been sold?
*Hint:* a LEFT JOIN and a NULL test, or NOT EXISTS.
*Check:* 4 rows.

**3.5** Average invoice value by channel for business year 2025 (leave returns out).
*Hint:* total sales / distinct invoices, not the average of the lines.
*Check:* 3 rows. Retail is highest at about £83.

**3.6** Total footfall by store type for business year 2025.
*Check:* 6 rows. High Street leads, at about 650,000 visitors.

## Level 4: CTEs and window functions

**4.1** The five best-selling styles in each brand for business year 2025.
*Hint:* RANK over a PARTITION BY brand, then filter with QUALIFY (or a CTE).
*Check:* 20 rows (5 x 4 brands).

**4.2** Net sales by business period for 2025 with a running total.
*Hint:* `SUM(...) OVER (ORDER BY ...)`.
*Check:* 12 rows. The last running total is the full-year figure, about £38.8m.

**4.3** For each business period of 2025, the year-on-year change against the same period the year before.
*Hint:* `LAG(x, 12)` over periods in order. You need the earlier years in the CTE, then filter to 2025 at the end.
*Check:* 12 rows, every one within about 2% of last year.

**4.4** What share of business year 2025 net sales came from the top 10% of stores?
*Hint:* `NTILE(10)` over stores ranked by sales.
*Check:* the top decile is 37 stores and makes about 30% of sales.

**4.5** Which Retail-channel stores beat the average of their own market in business year 2025?
*Hint:* `AVG(...) OVER (PARTITION BY market)` with QUALIFY.
*Check:* about 98 stores.

**4.6** Weekly net sales with a 4-week moving average, latest 10 weeks.
*Hint:* group by `business_year, business_week_number`, then `ROWS BETWEEN 3 PRECEDING AND CURRENT ROW`.
*Check:* 10 rows. The newest week is unfinished, so it looks low.

## Level 5: Business questions

**5.1** Net sales against target by store type for business year 2025: actual, target and achievement %.
*Hint:* sum sales to store and period first, then join to `fact_targets`.
*Check:* 7 rows, achievement between about 94% and 97%.

**5.2** Weeks of cover for each major product group at the latest stock snapshot.
*Hint:* latest snapshot only, divided by average weekly units sold (before returns) over the last four weeks.
*Check:* 7 rows. Outerwear is highest, around 16 weeks.

**5.3** Net contribution % by market for 2025, with a flag for markets below the company figure.
*Hint:* a CTE for the company percentage, and CASE WHEN for the flag.
*Check:* 11 rows. The lowest market is around 26%.

**5.4** The five best sales days in calendar 2025, with the day name and any promotion running that day (or "No promotion").
*Hint:* a LEFT JOIN from each date to `dim_promo` with BETWEEN on the promo's dates.
*Check:* 5 rows. The top day is a Saturday in November.

**5.5** Digital sales as a share of each market's total sales for business year 2025.
*Hint:* sum each side to market level first, then join. This is the fan-out lesson from `04_joins.sql`.
*Check:* 11 rows. Latvia is highest, at about 72%.

**5.6** Design your own. Think of a question the business might ask, write the query, and check that it looks believable.
For example: which brand has the highest return rate? Which store type has the best sales per visitor? Do weekend shoppers buy more units per invoice? The sample answer for the first is in `solutions.sql`.

---

## When you've done these

- Rewrite three of the `queries/` business questions from scratch without looking.
- Take a Power BI KPI card and reproduce its number in SQL. If they don't match, working out why is the best SQL practice there is.
- Run `python sql/duck.py check` after you add queries to the suite, to be sure they all still run.