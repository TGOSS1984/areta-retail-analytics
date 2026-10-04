# generator

The synthetic data pipeline. Everything in `data/`, and so everything Power BI, the SQL suite and the web app show, comes from here.

- `config/`: `markets.yml` (the eleven markets, their weighting, cities and currencies) and `brands.yml` (the four brands and their ranges).
- `dimensions/`: one script per dimension: date, period, store, product, promo and currency.
- `facts/`: one script per fact table: sales, footfall, stock, store finance, targets, and the website's sales, traffic and targets. Most of the tuning lives at the top of these scripts as named constants with a comment saying why each value is what it is, for example the growth rates, margin offsets and popularity spread in `build_fact_sales.py`.
- `clean/`: turns the deliberately messy raw sales file in `data/raw` into the clean one in `data/staging` and `data/warehouse`, and records what it fixed.
- `quality/`: the 80-check audit that runs last and writes `dq_check_results` and `dq_table_profile`.
- `export_web_data.py`: the smaller, pre-aggregated files the web app reads.
- `weekly_refresh.py`: the entry point. It runs all 17 steps in order and stops at the first failure. The GitHub Action calls it every Monday.

Run it from the repo root with `python generator/weekly_refresh.py`. It takes about two minutes, and generates data up to today, so each run adds the days since the last one. The random seeds are fixed, so a re-run on the same day gives the same data.