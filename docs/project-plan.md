# Project plan

How the project came together, in the order I built it. What's still to do lives in the README's [roadmap](../README.md#roadmap), so this file is the history rather than the to-do list.

## 1. The data

A Python generator for a fictional outdoor retailer, Areta Mountain Systems: four brands, 361 stores across 11 markets, 907 styles, and a sales simulation at invoice-line grain with promotions, VAT, currencies, returns and multi-buys. Then footfall, stock snapshots, targets, a store P&L, and the website's sales, traffic and targets. Everything is orchestrated by `generator/weekly_refresh.py` and lands as a Parquet star schema in `data/warehouse/`.

Later rounds made it behave more like a real business: style popularity and a proper Pareto curve, key trading days (Black Friday, Boxing Day, Christmas closures), growth that differs by channel, category, brand, market and store, margin that varies by category, multi-buys at a realistic level, and a shopping funnel on the website.

## 2. Data quality

An 80-check audit that runs at the end of every refresh and writes its results back as two tables, so the report can show whether its own numbers can be trusted. The raw sales file is deliberately messy, and the cleaning step records what it fixed.

## 3. The Power BI model and report

A PBIP project so the model and report sit in git as text. The model has 472 measures, a business-calendar LY pattern that works at any grain, targets that work below period level, VAT and currency calculation groups, Pareto, range analysis and a P&L bridge. The report has ten pages, built and exported to PDF. `docs/report-pages.md` describes each one.

## 4. Automation

A GitHub Actions workflow runs the refresh every Monday and commits the new data. It hasn't run on GitHub yet.

## 5. The web app

A Next.js dashboard that reads pre-aggregated Parquet in the browser with DuckDB-wasm: no server, no database, deployed on Vercel. Eleven pages with shared filters in the URL.

## 6. The SQL suite

118 queries in eleven files against the same warehouse in DuckDB, from the basics through window functions to business questions and the data quality checks, plus 30 practice exercises.

## Decisions along the way

The bigger choices have their own records in `docs/decisions/`: why the data is fictional, why the web stack is small, and why Fabric is a side piece rather than a rebuild. Smaller ones, and the mistakes behind them, are in the README's "things that went wrong" section.

## Still to decide

- **Customer type** (new, returning, trade, staff). There's no customer anywhere in the model yet. The smallest useful version is probably a column on `fact_sales` rather than a full customer dimension, but I want to decide that deliberately rather than default into it.