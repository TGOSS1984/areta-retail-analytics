# 0002: A small web stack

## Status
Accepted (corrected after the build)

## Context
My early plan had the web app on a heavyweight modern BI stack: Cube.js as a semantic layer, GraphQL in between, ClickHouse or Snowflake as the warehouse. That's a sensible architecture for a real multi-user product. For a portfolio dataset that fits comfortably in a browser's memory, it's far more than the job needs.

## Decision
No semantic layer service and no cloud warehouse. The web app reads pre-aggregated Parquet files, exported from the same star schema that feeds Power BI, straight into the browser with DuckDB-wasm. There's no backend.

The app is Next.js with Tailwind and ECharts. The first version of this record said Tremor for the charts and Zustand for the filter state. I used neither in the end: ECharts covers every chart, and the filters live in the URL, which also makes a filtered view something you can bookmark or share.

## Consequences
- No hosting cost, a static deploy on Vercel, and no server to keep alive.
- One source of truth: `data/warehouse` feeds both `powerbi/` and, through `data/exports`, `web/`, so the two can't drift apart.
- If this ever had to become a real multi-user product, a semantic layer and a proper warehouse would be the next step. I've noted that here rather than built it, because it wouldn't add anything to the portfolio.