"""
build_fact_digital_targets.py

Digital sales targets at (market_code, business_year, business_period)
grain — same "prior year x per-market growth" pattern build_fact_targets
.py uses for store-grain targets, adapted for market grain since digital
has no physical store to key off (same reason fact_digital_sales/
traffic are market-grain, not store-grain).

Deliberately a SEPARATE file and table (fact_digital_targets), not
folded into fact_targets — that table's whole schema and its
_target_for_metric() helper are built around store_id specifically;
bolting a different grain on would mean either duplicating store_id
with NULLs for digital rows (messy, same anti-pattern already avoided
for footfall/contribution's Online exclusion) or generalising a
working, already-verified helper for one extra caller. A small
dedicated script is the lower-risk option, and mirrors how
fact_digital_sales/traffic got their own tables rather than being
squeezed into the store-grain fact tables.

Depends on fact_digital_sales already existing in data/warehouse.

Usage:
    python build_fact_digital_targets.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_DIGITAL_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_digital_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_digital_targets.parquet"

RANDOM_SEED = 91  # distinct from build_fact_targets.py's 71, own independent sequence
GROWTH_MEAN = 0.05  # same +5% average growth assumption as the store-grain targets
GROWTH_STD = 0.03
FIRST_YEAR_NOISE_STD = 0.06


def build() -> pd.DataFrame:
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date", "business_year", "business_period_number"]]
    digital_sales = pd.read_parquet(FACT_DIGITAL_SALES_PATH).merge(
        dim_date, left_on="date", right_on="full_date", how="left"
    )

    first_year = int(dim_date["business_year"].min())
    all_periods = dim_date[["business_year", "business_period_number"]].drop_duplicates()
    market_codes = digital_sales["market_code"].drop_duplicates()

    actual = (
        digital_sales.groupby(["market_code", "business_year", "business_period_number"])["net_sales_gbp"]
        .sum()
        .reset_index()
    )

    full_grid = market_codes.to_frame().merge(all_periods, how="cross")
    grid = full_grid.merge(actual, on=["market_code", "business_year", "business_period_number"], how="left")

    prior = actual.rename(columns={"net_sales_gbp": "prior_net_sales_gbp"})
    prior["business_year"] = prior["business_year"] + 1
    grid = grid.merge(
        prior[["market_code", "business_year", "business_period_number", "prior_net_sales_gbp"]],
        on=["market_code", "business_year", "business_period_number"],
        how="left",
    )

    rng = np.random.default_rng(RANDOM_SEED)
    growth_by_market = pd.Series({m: rng.normal(GROWTH_MEAN, GROWTH_STD) for m in market_codes})
    growth = grid["market_code"].map(growth_by_market)

    is_first_year = grid["business_year"] == first_year
    noise_rng = np.random.default_rng(RANDOM_SEED + 1)
    first_year_noise = noise_rng.normal(0, FIRST_YEAR_NOISE_STD, size=len(grid))

    base_first_year = grid["net_sales_gbp"].fillna(0)
    base_later_years = grid["prior_net_sales_gbp"].fillna(grid["net_sales_gbp"]).fillna(0)

    target = np.where(
        is_first_year,
        base_first_year * (1 + first_year_noise),
        base_later_years * (1 + growth),
    )
    grid["target_digital_net_sales_gbp"] = np.maximum(target, 0).round(2)

    grid["period_key"] = grid["business_year"] * 100 + grid["business_period_number"]
    grid["actual_net_sales_gbp"] = grid["net_sales_gbp"]  # kept for the sanity-check print only

    return grid[
        ["market_code", "business_year", "business_period_number", "period_key",
         "target_digital_net_sales_gbp", "actual_net_sales_gbp"]
    ]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.drop(columns="actual_net_sales_gbp").to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_digital_targets: {len(df):,} rows -> {OUTPUT_PATH}")

    with_actual = df.dropna(subset=["actual_net_sales_gbp"])
    hit_rate = (with_actual["actual_net_sales_gbp"] >= with_actual["target_digital_net_sales_gbp"]).mean()
    n_future = df["actual_net_sales_gbp"].isna().sum()
    print(
        f"sanity check: {hit_rate:.1%} of market-periods WITH actuals hit or beat target "
        f"(expect well short of 100%, well above 0%)"
    )
    print(f"{n_future:,} market-periods have a target but no actual yet — future periods, as intended")


if __name__ == "__main__":
    main()