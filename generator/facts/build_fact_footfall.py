"""
build_fact_footfall.py

Daily footfall / transactions / conversion at (date, store) grain — dense,
not sparse like fact_sales, since a door counter runs every day whether
anyone buys anything or not.

Reads the already-cleaned fact_sales to get each store's actual net units
sold per day, then derives transaction count from it via a per-store-day
"items per basket" draw. Doing it this way round — deriving transactions
from units actually sold, rather than simulating footfall and sales as two
unrelated random processes — is what keeps "items per transaction" and
conversion rate landing somewhere sane instead of technically-computable
nonsense.

Footfall = transactions / conversion_rate, with conversion drawn per
store-day around a channel baseline. Concessions convert lower — most of
that footfall is there for the host store (garden centre, department
store), not specifically for Areta.

Depends on fact_sales already existing in data/warehouse — run this after
clean/clean_fact_sales.py, not before.

Usage:
    python build_fact_footfall.py
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_footfall.parquet"

RANDOM_SEED = 55

BASKET_SIZE_MEAN = 1.9
BASKET_SIZE_SHAPE = 4.0  # higher = tighter spread around the mean

CONVERSION_BASELINE = {"Retail": 0.26, "Concession": 0.15}
CONVERSION_DAILY_NOISE = 0.05


def _store_seed(store_id: str) -> int:
    # same hashing scheme as build_fact_sales.py's _store_seed — not used
    # directly in this version (footfall is derived from actual units sold
    # rather than an independent store-strength draw) but kept here since
    # the next iteration of this file may want it for the "quiet day"
    # baseline instead of a flat random range.
    return int(hashlib.sha256(store_id.encode()).hexdigest(), 16) % (2**32)


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date"]].rename(columns={"full_date": "date"})
    sales = pd.read_parquet(FACT_SALES_PATH)

    # net units per store per day — returns (negative quantity) don't
    # generate footfall/transactions of their own, only original purchases do
    daily_units = (
        sales[~sales["is_return"]]
        .groupby(["store_id", "date"])["quantity"]
        .sum()
        .rename("units_sold")
        .reset_index()
    )

    # dense (store, date) grid — every store, every day
    grid = dim_store[["store_id", "channel"]].merge(dim_date, how="cross")
    grid = grid.merge(daily_units, on=["store_id", "date"], how="left")
    grid["units_sold"] = grid["units_sold"].fillna(0).astype(int)

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(grid)

    basket_size = rng.gamma(BASKET_SIZE_SHAPE, BASKET_SIZE_MEAN / BASKET_SIZE_SHAPE, size=n)
    basket_size = np.clip(basket_size, 1.0, None)

    transactions = np.where(
        grid["units_sold"] > 0,
        np.maximum(1, np.round(grid["units_sold"] / basket_size)),
        0,
    ).astype(int)
    grid["transactions"] = transactions

    conv_baseline = grid["channel"].map(CONVERSION_BASELINE).to_numpy()
    conv_noise = rng.normal(0, CONVERSION_DAILY_NOISE, size=n)
    conversion_draw = np.clip(conv_baseline + conv_noise, 0.05, 0.55)

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


if __name__ == "__main__":
    main()