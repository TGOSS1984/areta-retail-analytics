# generator

The synthetic data pipeline — the single source of truth both `powerbi/` and `web/` read from.

- `config/` — the knobs: market weighting, brand/product mix, seasonal sales curves, target-setting rules. Edit these, not the build scripts, when tuning the dataset.
- `dimensions/` — one script per dimension table (date, store, product, promo, currency).
- `facts/` — one script per fact table (sales, targets, stock, footfall, finance). Depends on dimensions being built first.
- `clean/` — takes the deliberately-messy first-pass output in `data/raw` and produces the cleaned version in `data/staging`. This is where the "messy data → cleaned data" story in the README actually lives.
- `weekly_refresh.py` — the entry point. Runs the full pipeline end to end; this is what the GitHub Action calls on a schedule.

Run order: dimensions → facts (raw) → clean → warehouse tables → exports for the web app.
