<!-- TODO: swap in branding/areta-branding-board.png once the repo is public -->
<p align="center">
  <img src="branding/areta-logo.png" alt="Areta Mountain Systems" width="220" />
</p>

<h1 align="center">Areta Retail Analytics</h1>
<p align="center"><i>Higher ground awaits.</i></p>

<!-- TODO: badges — replace with real ones once CI/deploy exist
[![Power BI](https://img.shields.io/badge/Power%20BI-model-F2C811?logo=powerbi&logoColor=black)]()
[![Next.js](https://img.shields.io/badge/Next.js-app-000000?logo=nextdotjs)]()
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)]()
[![DuckDB](https://img.shields.io/badge/DuckDB-wasm-FFF000?logo=duckdb&logoColor=black)]()
-->

## What this is

Areta Mountain Systems is a fictional multi-brand outdoor retailer I built from scratch — synthetic stores, synthetic products, synthetic sales — so I could put together the kind of retail analytics suite I work on day to day, without touching anything belonging to a real employer.

It's two things pointed at the same data model:

1. A Power BI report — star schema, DAX measures, a branded theme, the works.
2. A web dashboard on the same data — a browser-native "app" version of the same story, built to show I can work outside the Power BI ecosystem too.

Why fictional? Short version: I wanted to build something portfolio-safe from day one rather than laundering real employer data into something "close enough." Longer version is in `docs/decisions/0001-fictional-brand-and-synthetic-data.md`.

## Architecture

<!-- TODO: drop docs/architecture/pipeline-overview.png here once drawn -->

Data flows one way, generator → warehouse → both front ends:

```
generator/  →  data/raw  →  data/staging  →  data/warehouse  →  powerbi/  (Power BI import)
                                                              ↘  data/exports  →  web/  (DuckDB-wasm)
```

One synthetic data pipeline, two consumers, so the numbers never drift between the Power BI report and the web app.

## Data model

Star schema — dimensions: date, store, product (brand → style → colour → size), promo, currency. Facts: sales, targets, stock snapshot (weekly), footfall, store finance.

Full field-level breakdown lives in `docs/data-dictionary.md`.

## Business questions this answers

See `docs/business-questions.md` for the full list — covers sales/margin performance, store-level contribution, stock health, and target tracking.

## Getting started

```bash
# generate the synthetic dataset
cd generator
pip install -r requirements.txt
python weekly_refresh.py

# Power BI
# open powerbi/areta-retail-analytics.pbip in Power BI Desktop

# web app
cd web
npm install
npm run dev
```

## Screenshots

<!-- TODO: docs/screenshots/dashboard-overview.png -->
<!-- TODO: docs/screenshots/powerbi-report.png -->
<!-- TODO: docs/screenshots/areta-retail-analytics.pdf — full PBI export -->

## Tech stack

| Layer | Tools |
|---|---|
| Data generation | Python, pandas, PyArrow |
| Warehouse | Parquet, star schema |
| BI | Power BI (pbip), DAX, Deneb for the custom visuals |
| Web app | Next.js, Tailwind, Tremor, ECharts, Zustand, DuckDB-wasm |
| Automation | GitHub Actions (weekly synthetic refresh) |

## Project structure

See the top-level folders — `generator/`, `data/`, `powerbi/`, `web/`, `docs/`. Each has its own README where it's not self-explanatory.

## License

MIT — see `LICENSE`.
