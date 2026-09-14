"""
build_fact_targets.py

Sales targets at (store, retail_year, retail_period) grain — matches how
targets actually get set in retail: relative to the same period last
year, not built up from scratch, and not at daily or SKU grain.

Target for period P in year Y = actual net sales for period P in year Y-1,
uplifted by a per-store growth assumption. For the first year in the
dataset there's no prior year to base anything on, so that year's targets
are set directly off that same year's actual, with a bit of noise — a
reasonable stand-in for "target-setting before there was any history."

The growth assumption varies store to store but isn't tied to that store's
actual future performance in any way — that's the whole point. It's what
lets some stores end up beating target and others missing it, rather than
actual suspiciously tracking target everywhere because both come from the
same number.

Depends on fact_sales already existing in data/warehouse.

Usage:
    python build_fact_targets.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_targets.parquet"

RANDOM_SEED = 71
GROWTH_MEAN = 0.05   # +5% target growth on average, store to store
GROWTH_STD = 0.03
FIRST_YEAR_NOISE_STD = 0.06


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date", "retail_year", "retail_period_number"]]
    sales = pd.read_parquet(FACT_SALES_PATH)

    sales = sales.merge(dim_date, left_on="date", right_on="full_date", how="left")
    actual = (
        sales.groupby(["store_id", "retail_year", "retail_period_number"])["net_sales_gbp"]
        .sum()
        .rename("actual_net_sales_gbp")
        .reset_index()
    )

    first_year = int(actual["retail_year"].min())

    # self-join to find each (store, period)'s actual from exactly one
    # retail year earlier, if it exists
    prior = actual.rename(columns={"actual_net_sales_gbp": "prior_actual_net_sales_gbp"})
    prior["retail_year"] = prior["retail_year"] + 1
    merged = actual.merge(
        prior[["store_id", "retail_year", "retail_period_number", "prior_actual_net_sales_gbp"]],
        on=["store_id", "retail_year", "retail_period_number"],
        how="left",
    )

    rng = np.random.default_rng(RANDOM_SEED)
    growth_by_store = pd.Series(
        {store_id: rng.normal(GROWTH_MEAN, GROWTH_STD) for store_id in dim_store["store_id"]}
    )
    merged["growth"] = merged["store_id"].map(growth_by_store)

    is_first_year = merged["retail_year"] == first_year
    noise_rng = np.random.default_rng(RANDOM_SEED + 1)
    first_year_noise = noise_rng.normal(0, FIRST_YEAR_NOISE_STD, size=len(merged))

    base_for_later_years = merged["prior_actual_net_sales_gbp"].fillna(merged["actual_net_sales_gbp"])
    target = np.where(
        is_first_year,
        merged["actual_net_sales_gbp"] * (1 + first_year_noise),
        base_for_later_years * (1 + merged["growth"]),
    )

    merged["target_net_sales_gbp"] = np.round(np.maximum(target, 0), 2)
    # single-column key matching dim_date[period_key] — see that script for why
    merged["period_key"] = merged["retail_year"] * 100 + merged["retail_period_number"]
    return merged[["store_id", "retail_year", "retail_period_number", "period_key", "target_net_sales_gbp", "actual_net_sales_gbp"]]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # actual_net_sales_gbp only kept around for the sanity print below —
    # fact_sales is the real source of truth for actuals, no need to carry
    # a redundant copy of it into the warehouse table
    df.drop(columns="actual_net_sales_gbp").to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_targets: {len(df):,} rows -> {OUTPUT_PATH}")

    hit_rate = (df["actual_net_sales_gbp"] >= df["target_net_sales_gbp"]).mean()
    print(f"sanity check: {hit_rate:.1%} of store-periods hit or beat target (expect well short of 100%, well above 0%)")


if __name__ == "__main__":
    main()