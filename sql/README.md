# SQL suite

A set of SQL queries for the Areta warehouse, plus a place to practise writing your own. The warehouse is the parquet files in `data/warehouse/`, the same tables Power BI reads, so a SQL answer can be checked against a number on a report page.

I built it this way for a few reasons: I want to get properly good at SQL for work, real questions stick better than textbook ones, and nothing needs installing beyond one Python package. DuckDB reads the parquet files directly, so there's no database server and no loading step. The web app already uses DuckDB, so it's the same engine as the rest of the project.

## Getting started

Run everything from the repo root.

```
pip install -r sql/requirements.txt
python sql/duck.py check          # runs every query in the suite, should say 0 problems
python sql/duck.py ui             # opens a notebook in your browser
```

The tables are views over the parquet files, so when the weekly refresh rewrites the warehouse you're querying the new data straight away.

## Four ways to work

| Command | What it gives you |
|---|---|
| `python sql/duck.py ui` | A notebook in the browser (the DuckDB UI), best for exploring. It downloads a small extension on first use, so it needs internet once. Queries and data stay on your machine. Leave the terminal window open while you use it. |
| `python sql/duck.py shell` | A SQL prompt in the terminal. End a query with `;`. Type `.tables`, `.schema <table>` or `.help`. |
| `python sql/duck.py run <file.sql>` | Runs a query file and prints every result. Add `--only 3` to run just query 3, and `--rows 100` to see more rows. |
| `python sql/duck.py build` | Writes `sql/warehouse.duckdb` so DBeaver or another SQL client can connect to the warehouse. |

`python sql/duck.py schema` lists every table with its columns, and `schema dim_store` describes one.

## What's in here

| Path | What it is |
|---|---|
| `queries/01_explore_the_warehouse.sql` | What tables exist, how big, what a row looks like. Do this first with any database. |
| `queries/02_select_filter_sort.sql` | SELECT, WHERE, ORDER BY, CASE, dates, text |
| `queries/03_aggregation.sql` | GROUP BY, HAVING, ratios, medians, ROLLUP |
| `queries/04_joins.sql` | Inner, left and cross joins, anti-joins, and the fan-out trap |
| `queries/05_ctes_and_subqueries.sql` | CTEs, subqueries, EXISTS, a recursive CTE |
| `queries/06_window_functions.sql` | RANK, LAG, running totals, moving averages, Pareto |
| `queries/07_business_questions_sales.sql` | Trading, channels, markets, seasonality, returns |
| `queries/08_business_questions_stores_and_targets.sql` | Store league tables, vs-target, footfall and conversion |
| `queries/09_business_questions_products_promo_stock.sql` | Top products, category margin, promotions, stock cover |
| `queries/10_business_questions_digital_and_finance.sql` | Website funnel and conversion, the P&L, contribution |
| `queries/11_data_quality_checks.sql` | Orphans, duplicates and reconciliations written in SQL |
| `practice/exercises.md` | 30 exercises in five levels, with hints and things to check |
| `practice/solutions.sql` | Answers to every exercise |
| `practice/scratch.sql` | A blank pad, do anything |
| `duck.py` | The runner behind all the commands above |

Every query is one block under a `-- ## title` line, and has a short comment explaining the idea. Files 01 to 06 teach a concept each. Files 07 to 11 answer business questions, and a lot of them are the SQL equivalent of a Power BI page.

## How I'd use it

1. **Read and run 01 to 04**, changing things as you go: another year, another column, a different filter. Breaking a query on purpose is a good way to learn what it does.
2. **Do exercise levels 1 to 3** in `practice/exercises.md`, writing your own answers.
3. **Read 05 and 06**, then do level 4. Window functions are worth the effort, because they come up in interviews all the time.
4. **Work through 07 to 10**, then try to reproduce a report number in SQL. When the numbers disagree, tracking down why is where the real learning happens.
5. **Do level 5 and exercise 5.6**, where you invent the question yourself.

For freewheeling, use `practice/scratch.sql` or the UI notebook, and start on `v_sales_flat`. It's `fact_sales` already joined to the store, product, promo and calendar tables, so you can practise GROUP BY on a single table before joins make sense.

## Things worth knowing about this data

- **Business years run March to February.** Use `dim_date.business_year` and `business_period_number`, not the calendar year. There are 12 periods a year, so `LAG(x, 12)` over periods is the same period last year.
- **Returns are negative lines.** `SUM(net_sales_gbp)` already nets them off. Some measures (units sold, footfall transactions, digital sales) are *before* returns, which is why `NOT is_return` shows up so often.
- **Watch the grain.** `fact_sales` is one row per invoice line, `fact_footfall` one per store per day, `fact_targets` one per store per period. Joining two facts directly multiplies rows, so sum each to the same grain first. `04_joins.sql` query 5 shows what goes wrong.
- **Never add up stock snapshots.** `fact_stock_snapshot` is a weekly balance. "Stock now" is the latest snapshot only.
- **Numbers differ slightly between builds.** The data is regenerated each time the pipeline runs, so figures move by a fraction of a percent. Row counts on the dimensions don't change.
- **Some answers are boring.** Return rates barely differ by category, because the generator draws returns at a flat rate. Knowing what the data does and doesn't contain is part of using it honestly. (Black Friday used to be in this list at an uplift of about 1.00. The generator now models the surge, so query 6b in `09_business_questions_products_promo_stock.sql` has a real answer.)

## DuckDB and the SQL you'll meet at work

DuckDB's SQL is close to PostgreSQL and mostly standard, so what you learn here carries over. The bits that differ:

| Task | DuckDB (used here) | SQL Server (T-SQL) | PostgreSQL |
|---|---|---|---|
| First 10 rows | `LIMIT 10` | `SELECT TOP 10 ...` | `LIMIT 10` |
| Join text | `'a' \|\| 'b'` | `'a' + 'b'` or `CONCAT` | `'a' \|\| 'b'` |
| Add days | `d + 7` or `d + INTERVAL 7 DAY` | `DATEADD(day, 7, d)` | `d + 7` or `d + INTERVAL '7 days'` |
| Days between | `date_diff('day', a, b)` or `b - a` | `DATEDIFF(day, a, b)` | `b - a` |
| Start of month | `DATE_TRUNC('month', d)` | `DATETRUNC(month, d)` (2022+) | `DATE_TRUNC('month', d)` |
| Year of a date | `EXTRACT(year FROM d)` | `YEAR(d)` | `EXTRACT(year FROM d)` |
| Convert type | `CAST(x AS DOUBLE)` or `x::DOUBLE` | `CAST(x AS FLOAT)` | `CAST(x AS DOUBLE PRECISION)` or `x::float` |
| Conditional sum | `SUM(x) FILTER (WHERE c)` or `SUM(CASE WHEN c THEN x END)` | `SUM(CASE WHEN c THEN x END)` | either form |
| Filter on a window | `QUALIFY` | a CTE or subquery | a CTE or subquery |
| Quote a name | `"name"` | `[name]` | `"name"` |

`CASE WHEN`, `SUM(CASE WHEN ...)`, CTEs and the window functions work everywhere, so lean on those in an interview. `QUALIFY`, `FILTER`, `PIVOT`, `GROUP BY ALL` and `SELECT * EXCLUDE (...)` are DuckDB shortcuts. They're nice, but know the portable version too.

## Adding your own queries

Put a query in any file under `queries/`, under its own `-- ## title` line. If it's meant to return nothing (a data check), add `-- expect: no rows`. Then `python sql/duck.py check` confirms the whole suite still runs. When the schema changes, `check` is the quickest way to spot what broke.