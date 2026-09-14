# data

Four stages, one direction: `raw → staging → warehouse → exports`.

- `raw/` — first-pass generator output, deliberately left messy (inconsistent casing, duplicate-ish rows, missing values here and there) so the cleaning step in `generator/clean/` has real work to do.
- `staging/` — cleaned, typed, deduplicated. Still shaped like the raw tables, just tidy.
- `warehouse/` — the final star schema: dimension and fact tables, Parquet format. This is what Power BI imports from.
- `exports/` — pre-aggregated cuts of the warehouse tables, sized for the browser. This is what the web app reads via DuckDB-wasm.

Nothing here is real. See `docs/decisions/0001-fictional-brand-and-synthetic-data.md`.
