"""
build_fact_store_finance.py

Gross and net contribution at (store, business_year, business_period)
grain — the table my original schema sketch promised and never actually
built, until the audit caught it.

Gross contribution = net sales - COGS - store operating costs (rent,
staff, utilities, marketing). Net contribution = gross contribution -
head office allocation. Targets from the brief: ~30% gross, ~25% net,
with genuine store-to-store variety including some going negative.

The mechanism for that variety: rent, staff, and utilities are calibrated
once per store against that store's own LONG-RUN AVERAGE period sales,
then held FIXED in nominal terms across every period — they don't flex
with any given period's actual result. That's deliberate: a store with a
high fixed-cost base and a below-average period is exactly the scenario
that should show thin or negative contribution, same as a real P&L.
Marketing and head office allocation are the two costs that DO scale with
actual period sales, since local marketing spend and head-office
recharges genuinely move with trading volume in most retailers.

Depends on fact_sales (for COGS and net sales by store/period) and
dim_date (for business_year/period_key) already existing in data/warehouse.

Usage:
    python build_fact_store_finance.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_store_finance.parquet"

RANDOM_SEED = 123

RENT_RATIO_RANGE = (0.05, 0.19)
STAFF_RATIO_RANGE = (0.12, 0.22)
UTILITIES_RATIO_RANGE = (0.015, 0.035)
MARKETING_RATIO_RANGE = (0.012, 0.022)   # variable, applied to actual period sales
HEAD_OFFICE_RATIO_RANGE = (0.04, 0.06)   # variable, applied to actual period sales


def period_actuals() -> pd.DataFrame:
    """Net sales and COGS per (store, business_year, business_period)."""
    sales = pd.read_parquet(FACT_SALES_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)[
        ["full_date", "business_year", "business_period_number", "period_key"]
    ]
    sales = sales.merge(dim_date, left_on="date", right_on="full_date", how="left")

    return (
        sales.groupby(["store_id", "business_year", "business_period_number", "period_key"])
        .agg(net_sales_gbp=("net_sales_gbp", "sum"), cogs_gbp=("cost_gbp", "sum"))
        .reset_index()
    )


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)[["store_id"]]
    actuals = period_actuals()

    # each store's own long-run average period sales — used only to
    # calibrate the FIXED cost base, not as the denominator for any
    # single period's actual contribution %
    avg_period_sales = actuals.groupby("store_id")["net_sales_gbp"].mean().rename("avg_period_sales")

    rng = np.random.default_rng(RANDOM_SEED)
    fixed_ratios = pd.DataFrame(
        {
            "store_id": dim_store["store_id"],
            "rent_ratio": rng.uniform(*RENT_RATIO_RANGE, size=len(dim_store)),
            "staff_ratio": rng.uniform(*STAFF_RATIO_RANGE, size=len(dim_store)),
            "utilities_ratio": rng.uniform(*UTILITIES_RATIO_RANGE, size=len(dim_store)),
            "marketing_ratio": rng.uniform(*MARKETING_RATIO_RANGE, size=len(dim_store)),
            "head_office_ratio": rng.uniform(*HEAD_OFFICE_RATIO_RANGE, size=len(dim_store)),
        }
    ).set_index("store_id")

    df = actuals.join(avg_period_sales, on="store_id").join(fixed_ratios, on="store_id")

    df["rent_gbp"] = np.round(df["avg_period_sales"] * df["rent_ratio"], 2)
    df["staff_gbp"] = np.round(df["avg_period_sales"] * df["staff_ratio"], 2)
    df["utilities_gbp"] = np.round(df["avg_period_sales"] * df["utilities_ratio"], 2)

    df["marketing_gbp"] = np.round(df["net_sales_gbp"] * df["marketing_ratio"], 2)
    df["head_office_gbp"] = np.round(df["net_sales_gbp"] * df["head_office_ratio"], 2)

    df["gross_profit_gbp"] = df["net_sales_gbp"] - df["cogs_gbp"]
    df["store_operating_costs_gbp"] = (
        df["rent_gbp"] + df["staff_gbp"] + df["utilities_gbp"] + df["marketing_gbp"]
    )
    df["gross_contribution_gbp"] = np.round(df["gross_profit_gbp"] - df["store_operating_costs_gbp"], 2)
    df["gross_contribution_pct"] = np.round(df["gross_contribution_gbp"] / df["net_sales_gbp"], 4)
    df["net_contribution_gbp"] = np.round(df["gross_contribution_gbp"] - df["head_office_gbp"], 2)
    df["net_contribution_pct"] = np.round(df["net_contribution_gbp"] / df["net_sales_gbp"], 4)

    cols = [
        "store_id", "business_year", "business_period_number", "period_key",
        "net_sales_gbp", "cogs_gbp", "gross_profit_gbp",
        "rent_gbp", "staff_gbp", "utilities_gbp", "marketing_gbp",
        "gross_contribution_gbp", "gross_contribution_pct",
        "head_office_gbp", "net_contribution_gbp", "net_contribution_pct",
    ]
    return df[cols]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_store_finance: {len(df):,} rows -> {OUTPUT_PATH}")
    print(f"avg gross contribution %: {df['gross_contribution_pct'].mean():.1%}")
    print(f"avg net contribution %: {df['net_contribution_pct'].mean():.1%}")
    stores_with_negative = (df.groupby("store_id")["net_contribution_gbp"].min() < 0).sum()
    print(f"stores with at least one negative net-contribution period: {stores_with_negative} of {df['store_id'].nunique()}")
    print(f"pct of all store-periods with negative net contribution: {(df['net_contribution_gbp'] < 0).mean():.1%}")


if __name__ == "__main__":
    main()