"""
dim_promo builder.

Generates the promotional calendar — one row per promo instance per year
(2023-2026), plus a single "Full Price" row that fact_sales lines use when
a sale wasn't discounted. Depths deliberately land on 30/40/50/60/70% since
that's the breakdown the margin-by-discount-depth question in
docs/business-questions.md needs.

Black Friday's date is computed the same way as dim_date (4th Friday of
November) rather than hardcoded, so the two stay consistent automatically.

Straight to data/warehouse, same as the other dimensions.

Usage:
    python build_dim_promo.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_promo.parquet"

YEARS = range(2023, 2027)

# (name, promo_type, month, day, duration_days, discount_pct)
# day=None means "compute it" — only Black Friday needs that right now.
PROMO_TEMPLATES = [
    ("January Sale", "Seasonal Sale", 1, 2, 12, 30),
    ("January Mid-Sale", "Seasonal Sale", 1, 14, 10, 50),
    ("January Clearance", "Clearance", 1, 24, 8, 70),
    ("Spring Refresh", "Seasonal Sale", 4, 1, 14, 20),
    ("Summer Sale", "Seasonal Sale", 7, 1, 14, 30),
    ("Summer Clearance", "Clearance", 7, 15, 14, 50),
    ("Black Friday", "Flash Event", 11, None, 4, 40),
    ("Boxing Day Sale", "Flash Event", 12, 26, 6, 60),
]


def black_friday(year: int) -> dt.date:
    fridays_in_nov = [
        dt.date(year, 11, day)
        for day in range(1, 31)
        if dt.date(year, 11, day).weekday() == 4
    ]
    return fridays_in_nov[3]


def build() -> pd.DataFrame:
    rows = [
        {
            "promo_id": "PROMO0000",
            "promo_name": "Full Price",
            "promo_type": "None",
            "start_date": None,
            "end_date": None,
            "discount_pct": 0,
        }
    ]

    promo_seq = 1
    for year in YEARS:
        for name, promo_type, month, day, duration_days, discount_pct in PROMO_TEMPLATES:
            start = black_friday(year) if day is None else dt.date(year, month, day)
            end = start + dt.timedelta(days=duration_days - 1)
            rows.append(
                {
                    "promo_id": f"PROMO{promo_seq:04d}",
                    "promo_name": f"{name} {year}",
                    "promo_type": promo_type,
                    "start_date": start,
                    "end_date": end,
                    "discount_pct": discount_pct,
                }
            )
            promo_seq += 1

    return pd.DataFrame(rows)


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"dim_promo: {len(df):,} rows -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()