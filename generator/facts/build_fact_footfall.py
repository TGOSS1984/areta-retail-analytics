"""
build_fact_footfall.py

Daily footfall / transactions / conversion at (date, store) grain — dense,
not sparse like fact_sales, since a door counter runs every day whether
anyone buys anything or not.

Rebuilt now that fact_sales has a real invoice_id: transactions is now
COUNT(DISTINCT invoice_id) per store-day — an actual count, not the
basket-size estimate the first version had to use before invoices existed.
Footfall is still independently simulated (there's no real door-counter
dataset to draw from), calibrated so footfall = transactions / a
conversion rate drawn per store-day around a channel baseline.

Conversion baseline is checked against real benchmarks, not guessed:
multiple industry sources (Dor, TruRating, Traf-Sys) put in-store
apparel/fashion conversion at roughly 15-25% typical, 30%+ for strong
performers, with specialty retail formats lower, around 10-20%. Retail
here sits centrally in the apparel band; concession sits toward the low
end of specialty retail, reflecting that most of that footfall is there
for the host store (garden centre, department store), not specifically
for Areta.

Depends on fact_sales already existing in data/warehouse — run this after
clean/clean_fact_sales.py, not before.

Usage:
    python build_fact_footfall.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_footfall.parquet"

RANDOM_SEED = 55

# same cutoff concept as build_fact_sales.py — footfall is an actual,
# observed metric same as sales, so it can't exist for a date that
# hasn't happened yet either. Kept independent rather than imported so
# this script has no dependency on fact_sales.py as a module, only on
# its output file.
PRESENT_DATE_OVERRIDE: dt.date | None = None


def present_date() -> dt.date:
    return PRESENT_DATE_OVERRIDE or dt.date.today()

# in-store apparel conversion runs ~15-25% typical, specialty retail
# ~10-20% — see module docstring for sources
CONVERSION_BASELINE = {"Retail": 0.22, "Concession": 0.13}
CONVERSION_DAILY_NOISE = 0.04


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    # Footfall is a physical-door-counter concept — doesn't exist for
    # Online. Excluded here rather than given a fabricated conversion
    # baseline (an "online conversion rate" is a real, different metric
    # — sessions-to-purchase — not modelled in this project yet).
    dim_store = dim_store[dim_store["channel"] != "Online"]
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date"]].rename(columns={"full_date": "date"})
    dim_date = dim_date[dim_date["date"] <= present_date()]
    sales = pd.read_parquet(FACT_SALES_PATH)

    # real invoice count per store per day — a return gets its own
    # invoice_id (see build_fact_sales.py) but isn't a new purchase visit,
    # so it's excluded from the conversion numerator
    daily_transactions = (
        sales[~sales["is_return"]]
        .groupby(["store_id", "date"])["invoice_id"]
        .nunique()
        .rename("transactions")
        .reset_index()
    )
    daily_units = (
        sales[~sales["is_return"]]
        .groupby(["store_id", "date"])["quantity"]
        .sum()
        .rename("units_sold")
        .reset_index()
    )

    # dense (store, date) grid — every store, every day
    grid = dim_store[["store_id", "channel"]].merge(dim_date, how="cross")
    grid = grid.merge(daily_transactions, on=["store_id", "date"], how="left")
    grid = grid.merge(daily_units, on=["store_id", "date"], how="left")
    grid["transactions"] = grid["transactions"].fillna(0).astype(int)
    grid["units_sold"] = grid["units_sold"].fillna(0).astype(int)

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(grid)

    conv_baseline = grid["channel"].map(CONVERSION_BASELINE).to_numpy()
    conv_noise = rng.normal(0, CONVERSION_DAILY_NOISE, size=n)
    conversion_draw = np.clip(conv_baseline + conv_noise, 0.05, 0.50)

    footfall = np.where(
        grid["transactions"] > 0,
        np.round(grid["transactions"] / conversion_draw),
        rng.integers(5, 40, size=n),  # quiet days still get some passing footfall
    ).astype(int)
    grid["footfall"] = np.maximum(footfall, grid["transactions"])

    # recompute conversion_rate from the final integer footfall/transactions
    # so the two columns are always internally consistent, not just close
    grid["conversion_rate"] = np.where(
        grid["footfall"] > 0, grid["transactions"] / grid["footfall"], 0.0
    ).round(4)

    return grid[["date", "store_id", "footfall", "transactions", "units_sold", "conversion_rate"]]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_footfall: {len(df):,} rows -> {OUTPUT_PATH}")
    print(f"blended conversion rate: {df['transactions'].sum() / df['footfall'].sum():.1%}")
    print(f"items per transaction: {df['units_sold'].sum() / df['transactions'].sum():.2f}")


if __name__ == "__main__":
    main()