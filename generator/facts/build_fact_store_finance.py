"""
build_fact_store_finance.py

Gross and net contribution at (store, business_year, business_period)
grain. Gross contribution = net sales - COGS - store operating costs
(rent, staff, utilities, marketing). Net contribution = gross contribution
- head office allocation.

REDESIGNED (see the project README's "things that went wrong" list): the
first version calibrated rent/staff/utilities against each store's OWN
long-run average sales, which meant every store's fixed-cost base fit that
store almost perfectly, and the resulting contribution spread was far too
narrow — no store ever went below about 13%, and none went negative, which
isn't how a real multi-hundred-store retail estate looks.

The fix ties Retail-channel rent and utilities to the store's SQUARE
FOOTAGE (dim_store[square_footage]) instead, at a £-per-sq-ft rate that is
drawn independently of that store's own trading performance. Footprint
and footfall come from two unrelated random draws (see dim_store's own
docstring), so some stores end up with more space than their trading
actually supports — a large-format store in a middling market, say — and
that mismatch is what now produces a genuine tail of weak and loss-making
stores, the same way it does in real retail.

Concession stores keep the OLD ratio-on-sales mechanism for rent and
utilities, not the new sqft-based one — a concession's cost is normally
a revenue-share deal with its host (a % of the concession's own sales),
not a fixed sqft lease, so that's a different and still-realistic
mechanism, not an inconsistency.

One honest limitation: the £-per-sq-ft rates below are calibrated to
THIS dataset's own (fairly modest) sales-per-sq-ft scale, not to real UK
retail rent benchmarks, which run far higher. Matching real absolute
rents against these stores' sales would sink nearly the whole estate —
the STRUCTURE (a format/demand mismatch driving genuine variation) is
the realistic part; the absolute £/sq ft is scaled down to fit.

Targets from the brief: genuine store-to-store variety including some
going negative, without dragging the whole estate down. Staff, marketing
and head office allocation are unchanged from the original design: staff
is still a fixed ratio calibrated to each store's own average sales (staff
count doesn't perfectly track footprint either, in reality), and marketing
and head office still scale with actual period sales, since local
marketing spend and head-office recharges genuinely move with trading
volume in most retailers.

Depends on fact_sales (for COGS and net sales by store/period), dim_date
(for business_year/period_key) and dim_store (for channel, store_type and
square_footage) already existing in data/warehouse.

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

# Retail channel: rent and utilities are £-per-sq-ft-per-YEAR rates, applied
# to dim_store[square_footage] and divided across the 12 business periods.
# Varies by store_type/host-format, same spirit as real UK retail lettings
# (a retail-park unit costs less per sq ft than a high-street one) but at
# a rate scaled to this dataset — see the docstring above.
RENT_RATE_PSF_YEAR = {
    "High Street": (5.0, 15.0),
    "Retail Park": (2.5, 7.0),
    "Shopping Centre": (5.0, 14.0),
    "Outlet": (3.0, 8.0),
    "Garden Centre": (2.5, 7.0),
    "Department Store": (4.0, 10.0),
}
UTIL_RATE_PSF_YEAR_RANGE = (1.2, 3.0)
PERIODS_PER_YEAR = 12

# Concession channel: unchanged mechanism — a ratio on the concession's OWN
# period sales, standing in for a revenue-share deal with the host.
CONCESSION_RENT_RATIO_RANGE = (0.10, 0.22)
CONCESSION_UTIL_RATIO_RANGE = (0.015, 0.035)

# Unchanged for both channels: fixed ratios calibrated to each store's own
# long-run average period sales (staff), or variable ratios on actual
# period sales (marketing, head office).
STAFF_RATIO_RANGE = (0.15, 0.25)
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
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    # rent/staff/utilities here are a physical-retail-estate cost model —
    # doesn't transfer to Online (no shop floor to rent). A real online
    # P&L (fulfilment, delivery, warehousing) is a genuinely different
    # cost structure this project hasn't modelled, so Online is excluded
    # here rather than given a fabricated "online rent" figure. Same
    # judgment call as fact_footfall's Online exclusion, documented the
    # same way — a real, known gap, not silently papered over.
    dim_store = dim_store[dim_store["channel"] != "Online"][
        ["store_id", "channel", "store_type", "square_footage"]
    ]
    actuals = period_actuals()
    actuals = actuals[actuals["store_id"].isin(dim_store["store_id"])]

    # each store's own long-run average period sales — used only to
    # calibrate the FIXED staff cost, not as the denominator for any
    # single period's actual contribution %
    avg_period_sales = actuals.groupby("store_id")["net_sales_gbp"].mean().rename("avg_period_sales")

    rng = np.random.default_rng(RANDOM_SEED)
    is_retail = (dim_store["channel"] == "Retail").to_numpy()
    n = len(dim_store)

    rent_rate_lo = dim_store["store_type"].map(lambda t: RENT_RATE_PSF_YEAR.get(t, (4.0, 10.0))[0]).to_numpy()
    rent_rate_hi = dim_store["store_type"].map(lambda t: RENT_RATE_PSF_YEAR.get(t, (4.0, 10.0))[1]).to_numpy()
    rent_rate_psf_year = rng.uniform(rent_rate_lo, rent_rate_hi)
    util_rate_psf_year = rng.uniform(*UTIL_RATE_PSF_YEAR_RANGE, size=n)

    ratios = pd.DataFrame(
        {
            "store_id": dim_store["store_id"],
            "channel": dim_store["channel"],
            "square_footage": dim_store["square_footage"],
            "rent_rate_psf_year": rent_rate_psf_year,
            "util_rate_psf_year": util_rate_psf_year,
            "concession_rent_ratio": rng.uniform(*CONCESSION_RENT_RATIO_RANGE, size=n),
            "concession_util_ratio": rng.uniform(*CONCESSION_UTIL_RATIO_RANGE, size=n),
            "staff_ratio": rng.uniform(*STAFF_RATIO_RANGE, size=n),
            "marketing_ratio": rng.uniform(*MARKETING_RATIO_RANGE, size=n),
            "head_office_ratio": rng.uniform(*HEAD_OFFICE_RATIO_RANGE, size=n),
        }
    ).set_index("store_id")

    df = actuals.join(avg_period_sales, on="store_id").join(ratios, on="store_id")
    is_retail_row = df["channel"] == "Retail"

    # Retail: rent and utilities driven by footprint, independent of that
    # store's own sales — the mismatch that creates real variety.
    retail_rent = df["square_footage"] * df["rent_rate_psf_year"] / PERIODS_PER_YEAR
    retail_util = df["square_footage"] * df["util_rate_psf_year"] / PERIODS_PER_YEAR
    # Concession: unchanged — a ratio on the concession's own period sales.
    concession_rent = df["net_sales_gbp"] * df["concession_rent_ratio"]
    concession_util = df["net_sales_gbp"] * df["concession_util_ratio"]

    df["rent_gbp"] = np.round(np.where(is_retail_row, retail_rent, concession_rent), 2)
    df["utilities_gbp"] = np.round(np.where(is_retail_row, retail_util, concession_util), 2)
    df["staff_gbp"] = np.round(df["avg_period_sales"] * df["staff_ratio"], 2)
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
    store_avg = df.groupby("store_id")["net_contribution_pct"].mean()
    print(f"stores averaging under 10% net contribution: {(store_avg < 0.10).sum()} of {len(store_avg)}")
    print(f"stores averaging negative net contribution: {(store_avg < 0).sum()} of {len(store_avg)}")
    stores_with_negative = (df.groupby("store_id")["net_contribution_gbp"].min() < 0).sum()
    print(f"stores with at least one negative net-contribution period: {stores_with_negative} of {df['store_id'].nunique()}")
    print(f"pct of all store-periods with negative net contribution: {(df['net_contribution_gbp'] < 0).mean():.1%}")


if __name__ == "__main__":
    main()