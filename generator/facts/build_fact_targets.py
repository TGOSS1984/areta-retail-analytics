"""
build_fact_targets.py

Sales targets at (store, business_year, business_period) grain — matches
how targets actually get set in retail: relative to the same period last
year, not built up from scratch, and not at daily or SKU grain.

Target for period P in year Y = actual net sales for period P in year
Y-1, uplifted by a per-store growth assumption. For the first business
year in the dataset there's no prior year to base anything on, so that
year's targets are set directly off that same year's actual, with a bit
of noise — a reasonable stand-in for "target-setting before there was any
history."

Rebuilt for two things at once: the business_year rename from the
calendar rework (this file had been sitting broken since then, on
purpose — no point fixing column names on a table that needed
restructuring anyway), and the actual restructuring itself. Previously
this table only had rows for (store, period) combinations that already
existed in fact_sales' actuals — meaning once fact_sales started stopping
at a present-date cutoff, every future period's target would have
silently disappeared too, which defeats the entire point of "targets run
to year end, actuals stop at today." Now it starts from the FULL
(store x business_year x business_period) grid regardless of whether
actuals exist yet, and only falls back to 0 in the one edge case where
even the prior year's data doesn't exist — which shouldn't happen given
the cutoff always sits within the dataset's final year.

The growth assumption varies store to store but isn't tied to that
store's actual future performance in any way — that's the whole point.
It's what lets some stores end up beating target and others missing it,
rather than actual suspiciously tracking target everywhere because both
come from the same number.

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
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date", "business_year", "business_period_number"]]
    sales = pd.read_parquet(FACT_SALES_PATH)

    sales = sales.merge(dim_date, left_on="date", right_on="full_date", how="left")
    actual = (
        sales.groupby(["store_id", "business_year", "business_period_number"])["net_sales_gbp"]
        .sum()
        .rename("actual_net_sales_gbp")
        .reset_index()
    )

    # full (store x business_year x business_period) grid, spanning the
    # WHOLE business calendar regardless of whether actuals exist yet —
    # this is what keeps targets running through year end once actuals
    # stop at a present-date cutoff
    all_periods = dim_date[["business_year", "business_period_number"]].drop_duplicates()
    full_grid = dim_store[["store_id"]].merge(all_periods, how="cross")
    full_grid = full_grid.merge(actual, on=["store_id", "business_year", "business_period_number"], how="left")

    first_year = int(dim_date["business_year"].min())

    # prior-year actual, via the same shift-and-merge as before — for any
    # period beyond the present-date cutoff, this is still fully known,
    # since "prior year" is necessarily a year that's already finished
    prior = actual.rename(columns={"actual_net_sales_gbp": "prior_actual_net_sales_gbp"})
    prior["business_year"] = prior["business_year"] + 1
    full_grid = full_grid.merge(
        prior[["store_id", "business_year", "business_period_number", "prior_actual_net_sales_gbp"]],
        on=["store_id", "business_year", "business_period_number"],
        how="left",
    )

    rng = np.random.default_rng(RANDOM_SEED)
    growth_by_store = pd.Series(
        {store_id: rng.normal(GROWTH_MEAN, GROWTH_STD) for store_id in dim_store["store_id"]}
    )
    full_grid["growth"] = full_grid["store_id"].map(growth_by_store)

    is_first_year = full_grid["business_year"] == first_year
    noise_rng = np.random.default_rng(RANDOM_SEED + 1)
    first_year_noise = noise_rng.normal(0, FIRST_YEAR_NOISE_STD, size=len(full_grid))

    # first year: base off that year's own actual (fillna(0) covers the
    # theoretical case of a period with no actual at all, shouldn't occur
    # in practice for a fully-elapsed first year)
    # later years: base off PRIOR year's actual — always available per
    # the note above
    base_first_year = full_grid["actual_net_sales_gbp"].fillna(0)
    base_later_years = full_grid["prior_actual_net_sales_gbp"].fillna(full_grid["actual_net_sales_gbp"]).fillna(0)

    target = np.where(
        is_first_year,
        base_first_year * (1 + first_year_noise),
        base_later_years * (1 + full_grid["growth"]),
    )

    full_grid["target_net_sales_gbp"] = np.round(np.maximum(target, 0), 2)
    full_grid["period_key"] = full_grid["business_year"] * 100 + full_grid["business_period_number"]

    return full_grid[
        ["store_id", "business_year", "business_period_number", "period_key",
         "target_net_sales_gbp", "actual_net_sales_gbp"]
    ]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.drop(columns="actual_net_sales_gbp").to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_targets: {len(df):,} rows -> {OUTPUT_PATH}")

    with_actual = df.dropna(subset=["actual_net_sales_gbp"])
    hit_rate = (with_actual["actual_net_sales_gbp"] >= with_actual["target_net_sales_gbp"]).mean()
    n_future = df["actual_net_sales_gbp"].isna().sum()
    print(f"sanity check: {hit_rate:.1%} of store-periods WITH actuals hit or beat target "
          f"(expect well short of 100%, well above 0%)")
    print(f"{n_future:,} store-periods have a target but no actual yet — the future ones, as intended")


if __name__ == "__main__":
    main()