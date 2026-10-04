# data

Four stages, in one direction: `raw`, then `staging`, then `warehouse`, then `exports`.

- `raw/`: the sales file as the generator first writes it, messy on purpose (duplicate lines, lowercase store IDs, stray spaces in currency codes, blank discounts), so the cleaning step has real work to do. Not committed.
- `staging/`: the same file cleaned and typed. Not committed.
- `warehouse/`: the star schema, as Parquet. Power BI, the SQL suite and the data quality audit all read from here. Every table is described in `docs/data-dictionary.md`.
- `exports/`: smaller, pre-aggregated files for the web app, which reads them in the browser with DuckDB-wasm.

Only the sales table goes through `raw` and `staging`. Everything else is written straight to `warehouse`, because there's nothing realistically messy about a generated store list.

None of this is real. See `docs/decisions/0001-fictional-brand-and-synthetic-data.md`.