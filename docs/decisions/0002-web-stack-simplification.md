# 0002 — Trimmed the web app stack

## Status
Accepted

## Context
Early planning had the web app running on a fairly heavy modern-BI stack: Cube.js as a semantic layer, GraphQL as the transport, ClickHouse or Snowflake as the warehouse. That's a legitimate architecture for a real multi-tenant product — it's overkill for a portfolio dataset that comfortably fits in a browser's memory.

## Decision
Dropped the semantic-layer service and the cloud warehouse. The web app reads pre-aggregated Parquet files (exported from the same star schema that feeds Power BI) directly in the browser via DuckDB-wasm. No backend server.

Kept: Next.js + Tailwind, Tremor/ECharts for the visuals, Zustand for cross-filter state.

## Consequences
- Zero hosting cost, trivial deploy (static/Vercel), no server to keep alive.
- One source of truth: `data/warehouse` feeds both `powerbi/` and `data/exports` → `web/`, so the two front ends can't drift apart.
- If this ever needed to scale to a real multi-user product, Cube.js + a proper warehouse is the documented next step — noted here rather than built, since it wouldn't add anything to the portfolio itself.
