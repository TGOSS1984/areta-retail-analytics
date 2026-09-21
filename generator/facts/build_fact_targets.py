"""
build_fact_targets.py

Targets at (store, business_year, business_period) grain, now covering
5 metrics, not just net sales — matches how targets actually get set in
retail: relative to the same period last year, not built up from
scratch, and not at daily or SKU grain.

Target for period P in year Y = actual for period P in year Y-1,
uplifted by a per-store growth assumption. For the first business year
in the dataset there's no prior year to base anything on, so that
year's targets are set directly off that same year's actual, with a bit
of noise — a reasonable stand-in for "target-setting before there was
any history." Same pattern this file has always used for net sales,
now generalised into one helper (`_target_for_metric`) and applied to
4 more metrics chosen because they're genuinely what retailers set
targets for in practice — not an exhaustive list of every measure in
this project. Deliberately NOT targeted here: promotional mix, digital,
and stock metrics — those are typically monitored, not targeted, in a
standard retail planning cycle, and adding them would be scope creep
beyond what was asked.

The 5 metrics, and why each one:
  - Net Sales (GBP)     — the original, unchanged in method
  - Net Units Sold       — volume target, standard alongside sales
  - Total Footfall       — the single most common physical-retail KPI
                            to target; EXCLUDES Online (no physical
                            door), same exclusion fact_footfall itself
                            already applies
  - Gross Margin %       — ADDITIVE growth (percentage-point
                            improvement), not multiplicative — a
                            margin target is normally stated as
                            "+0.5pp" not "+5% of the margin number
                            itself", which would compound oddly on a
                            ratio
  - Net Contribution     — the profitability target; EXCLUDES Online,
    (GBP)                  same reason and same exclusion as
                            fact_store_finance itself (no physical
                            rent/staff cost model for online)

Plus one DERIVED column, not a sixth independent target:
  - Gross Profit (GBP)   — target net sales x target gross margin %, row
                            by row. Deliberately derived rather than given
                            its own growth assumption, so the margin VALUE
                            and the margin RATE targets can never disagree
                            with each other or with the sales target.
                            It also means the margin % target at any level
                            of aggregation is simply target gross profit
                            divided by target net sales (sales-weighted),
                            not an average of per-store percentages, which
                            is what the Power BI measure now does.

Each metric gets its own independent per-store growth assumption
(different random seed offset) — not tied to that store's actual
future performance, which is the whole point: it's what lets some
stores beat target on units while missing it on margin, rather than
every metric suspiciously moving in lockstep.

Depends on fact_sales, fact_footfall, and fact_store_finance already
existing in data/warehouse — run AFTER all three, not alongside them.

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
FACT_FOOTFALL_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_footfall.parquet"
FACT_STORE_FINANCE_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_store_finance.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_targets.parquet"

RANDOM_SEED = 71
GROWTH_MEAN = 0.05  # +5% target growth on average, store to store — net sales, units, footfall, contribution
GROWTH_STD = 0.03
MARGIN_GROWTH_MEAN_PP = 0.005  # +0.5 percentage points on average — margin, additive not multiplicative
MARGIN_GROWTH_STD_PP = 0.003
FIRST_YEAR_NOISE_STD = 0.06


def _target_for_metric(
    full_grid: pd.DataFrame,
    actual: pd.DataFrame,
    metric_col: str,
    store_ids: pd.Series,
    first_year: int,
    seed_offset: int,
    additive: bool = False,
) -> pd.Series:
    """Same "prior year x per-store growth" pattern this file has always
    used for net sales, generalised to any metric. additive=True switches
    to percentage-POINT growth (for margin %) instead of multiplicative
    growth (everything else) — see the module docstring for why."""
    grid = full_grid.merge(actual, on=["store_id", "business_year", "business_period_number"], how="left")

    prior = actual.rename(columns={metric_col: f"prior_{metric_col}"})
    prior["business_year"] = prior["business_year"] + 1
    grid = grid.merge(
        prior[["store_id", "business_year", "business_period_number", f"prior_{metric_col}"]],
        on=["store_id", "business_year", "business_period_number"],
        how="left",
    )

    rng = np.random.default_rng(RANDOM_SEED + seed_offset)
    mean, std = (MARGIN_GROWTH_MEAN_PP, MARGIN_GROWTH_STD_PP) if additive else (GROWTH_MEAN, GROWTH_STD)
    growth_by_store = pd.Series({sid: rng.normal(mean, std) for sid in store_ids})
    growth = grid["store_id"].map(growth_by_store)

    is_first_year = grid["business_year"] == first_year
    noise_rng = np.random.default_rng(RANDOM_SEED + seed_offset + 1)
    first_year_noise = noise_rng.normal(0, FIRST_YEAR_NOISE_STD, size=len(grid))

    base_first_year = grid[metric_col].fillna(0)
    base_later_years = grid[f"prior_{metric_col}"].fillna(grid[metric_col]).fillna(0)

    if additive:
        target = np.where(is_first_year, base_first_year, base_later_years + growth)
    else:
        target = np.where(
            is_first_year,
            base_first_year * (1 + first_year_noise),
            base_later_years * (1 + growth),
        )

    # Margin is a ratio (can be negative in theory, e.g. a heavy
    # clearance period) — only floor at zero for the additive £/unit
    # metrics, not margin, where a hard floor at 0 would be wrong.
    return pd.Series(target if additive else np.maximum(target, 0), index=grid.index).round(4 if additive else 2)


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date", "business_year", "business_period_number"]]
    sales = pd.read_parquet(FACT_SALES_PATH).merge(dim_date, left_on="date", right_on="full_date", how="left")
    footfall = pd.read_parquet(FACT_FOOTFALL_PATH).merge(dim_date, left_on="date", right_on="full_date", how="left")
    finance = pd.read_parquet(FACT_STORE_FINANCE_PATH)

    first_year = int(dim_date["business_year"].min())
    all_periods = dim_date[["business_year", "business_period_number"]].drop_duplicates()

    # --- actuals per metric, at (store, business_year, business_period) ---
    sales_actual = (
        sales.groupby(["store_id", "business_year", "business_period_number"])
        .agg(net_sales_gbp=("net_sales_gbp", "sum"), quantity=("quantity", "sum"), cost_gbp=("cost_gbp", "sum"))
        .reset_index()
    )
    sales_actual["gross_margin_pct"] = np.where(
        sales_actual["net_sales_gbp"] > 0,
        1 - sales_actual["cost_gbp"] / sales_actual["net_sales_gbp"],
        0.0,
    )

    footfall_actual = (
        footfall.groupby(["store_id", "business_year", "business_period_number"])["footfall"].sum().reset_index()
    )

    # fact_store_finance is ALREADY at exactly this grain — no
    # re-aggregation needed, just select the columns.
    finance_actual = finance[["store_id", "business_year", "business_period_number", "net_contribution_gbp"]]

    # --- grids: all 361 stores for sales/units/margin, 350 physical-only for footfall/contribution ---
    all_store_ids = dim_store["store_id"]
    physical_store_ids = dim_store[dim_store["channel"] != "Online"]["store_id"]

    full_grid_all = all_store_ids.to_frame().merge(all_periods, how="cross")
    full_grid_physical = physical_store_ids.to_frame().merge(all_periods, how="cross")

    result = full_grid_all.copy()
    result["target_net_sales_gbp"] = _target_for_metric(
        full_grid_all, sales_actual[["store_id", "business_year", "business_period_number", "net_sales_gbp"]],
        "net_sales_gbp", all_store_ids, first_year, seed_offset=0,
    )
    result["target_net_units_sold"] = _target_for_metric(
        full_grid_all, sales_actual[["store_id", "business_year", "business_period_number", "quantity"]],
        "quantity", all_store_ids, first_year, seed_offset=10,
    )
    result["target_gross_margin_pct"] = _target_for_metric(
        full_grid_all, sales_actual[["store_id", "business_year", "business_period_number", "gross_margin_pct"]],
        "gross_margin_pct", all_store_ids, first_year, seed_offset=20, additive=True,
    )

    physical_targets = full_grid_physical.copy()
    physical_targets["target_footfall"] = _target_for_metric(
        full_grid_physical, footfall_actual, "footfall", physical_store_ids, first_year, seed_offset=30,
    )
    physical_targets["target_net_contribution_gbp"] = _target_for_metric(
        full_grid_physical, finance_actual, "net_contribution_gbp", physical_store_ids, first_year, seed_offset=40,
    )

    result = result.merge(
        physical_targets, on=["store_id", "business_year", "business_period_number"], how="left"
    )
    # Online rows correctly get NaN for footfall/contribution targets —
    # no physical door, no physical cost model, same documented gap as
    # the source facts themselves. Not filled with 0, which would look
    # like a real (met/missed) target rather than "not applicable".

    result["period_key"] = result["business_year"] * 100 + result["business_period_number"]

    # Margin value target = sales target x margin % target (see docstring).
    # Rounded to pennies like the other £ targets.
    result["target_gross_profit_gbp"] = (
        result["target_net_sales_gbp"] * result["target_gross_margin_pct"]
    ).round(2)

    # keep actual net sales alongside for the sanity-check print below,
    # same as before — dropped from the final parquet output
    result = result.merge(
        sales_actual[["store_id", "business_year", "business_period_number", "net_sales_gbp"]].rename(
            columns={"net_sales_gbp": "actual_net_sales_gbp"}
        ),
        on=["store_id", "business_year", "business_period_number"],
        how="left",
    )

    return result[
        [
            "store_id", "business_year", "business_period_number", "period_key",
            "target_net_sales_gbp", "target_net_units_sold", "target_gross_margin_pct",
            "target_gross_profit_gbp", "target_footfall", "target_net_contribution_gbp",
            "actual_net_sales_gbp",
        ]
    ]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.drop(columns="actual_net_sales_gbp").to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_targets: {len(df):,} rows -> {OUTPUT_PATH}")

    with_actual = df.dropna(subset=["actual_net_sales_gbp"])
    hit_rate = (with_actual["actual_net_sales_gbp"] >= with_actual["target_net_sales_gbp"]).mean()
    n_future = df["actual_net_sales_gbp"].isna().sum()
    print(
        f"sanity check: {hit_rate:.1%} of store-periods WITH actuals hit or beat net sales target "
        f"(expect well short of 100%, well above 0%)"
    )
    print(f"{n_future:,} store-periods have a target but no actual yet — the future ones, as intended")

    implied = df["target_gross_profit_gbp"].sum() / df["target_net_sales_gbp"].sum()
    print(
        f"gross profit target: {df['target_gross_profit_gbp'].sum():,.0f} across all periods, "
        f"implied sales-weighted margin target {implied:.2%}"
    )

    n_no_footfall_target = df["target_footfall"].isna().sum()
    print(
        f"{n_no_footfall_target:,} rows have no footfall/contribution target — "
        f"Online store-periods (no physical footfall/finance model) plus future periods"
    )


if __name__ == "__main__":
    main()