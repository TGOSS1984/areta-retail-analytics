"""
build_dim_period.py

Small bridge dimension: one row per (business_year, business_period),
with period_key as a genuine unique key. Exists specifically so
fact_targets and fact_store_finance — both at period grain, not daily —
can relate to something with a standard one-to-many relationship.

Without this, the only option is relating those two fact tables directly
to dim_date on period_key — but period_key isn't unique in dim_date (it
repeats once per day within a period) and isn't unique in the fact
tables either (once per store within a period), so that'd be a many-to-
many relationship on both sides. Power BI supports that, but it's a real
footgun: ambiguous cross-filter direction, and a behaviour trap for
anyone who didn't specifically choose it. A bridge table is the standard
fix for a period-grain fact needing to relate to a daily-grain date
dimension.

dim_date also relates to this (many-to-one, on period_key) — not just
the two period-grain facts — so filtering by a period in a report cascades
correctly down to the daily-grain facts (fact_sales, fact_footfall,
fact_stock_snapshot) via dim_date, not just the period-grain ones.

Derived entirely from dim_date — not an independent source of truth,
just a distinct grain of the same calendar.

Usage:
    python build_dim_period.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DIM_DATE_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_date.parquet"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_period.parquet"


def build() -> pd.DataFrame:
    dim_date = pd.read_parquet(DIM_DATE_PATH)

    periods = (
        dim_date.groupby(["business_year", "business_period_number"])
        .agg(
            period_start_date=("full_date", "min"),
            period_end_date=("full_date", "max"),
            business_period_label=("business_period_label", "first"),
            business_quarter=("business_quarter", "first"),
        )
        .reset_index()
        .sort_values(["business_year", "business_period_number"])
        .reset_index(drop=True)
    )
    periods["period_key"] = periods["business_year"] * 100 + periods["business_period_number"]
    return periods[
        ["period_key", "business_year", "business_period_number",
         "business_period_label", "business_quarter", "period_start_date", "period_end_date"]
    ]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"dim_period: {len(df):,} rows -> {OUTPUT_PATH}")
    dupes = df["period_key"].duplicated().sum()
    print(f"duplicate period_key: {dupes} (must be 0 for this to work as a relationship key)")


if __name__ == "__main__":
    main()