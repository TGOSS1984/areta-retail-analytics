"""
dim_date builder.

Rebuilt to match the actual spec after an audit found the first version
didn't: business year runs March-February here (not January-December),
season is a 2-value SS/AW model aligned to that business year (not four
meteorological seasons), and weeks run Sunday-Saturday (not Monday-Sunday).
All three were explicit in the original notes and I'd defaulted to
something else without checking back against them — see
docs/project-plan.md for the full audit.

Column naming: "retail_year"/"retail_week_number"/etc from the first
version are renamed to "business_year"/"business_week_number"/etc to match
the terminology actually used in the brief. Downstream tables that
referenced the old names need updating to match:
  - fact_footfall: no change needed, it only ever used full_date
  - fact_stock_snapshot: mechanical rename, done in the same commit as this
  - fact_targets: needs an actual restructure, not just a rename — handled
    as its own step, broken until then

Both calendar week (standard ISO week-of-year) and business week (the
4-4-5 week-of-business-year) are included as separate columns, per the
brief asking for both.

Usage:
    python build_dim_date.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

# --- config -----------------------------------------------------------
# First Sunday on/after 1 March 2023 (business year start, week start),
# through four full 52-week business years — BY2023..BY2026, where
# BY2026 = Mar 2026-Feb 2027. Comfortably spans "to date" for a
# September 2026 present-date cutoff with room left in BY2026.
_FIRST_OF_MARCH_2023 = dt.date(2023, 3, 1)
START_DATE = _FIRST_OF_MARCH_2023 + dt.timedelta(
    days=(6 - _FIRST_OF_MARCH_2023.weekday()) % 7
)  # first Sunday on/after 1 March 2023 — date.weekday() is Mon=0..Sun=6

WEEKS_PER_BUSINESS_YEAR = 52
N_BUSINESS_YEARS = 4
END_DATE = START_DATE + dt.timedelta(days=N_BUSINESS_YEARS * WEEKS_PER_BUSINESS_YEAR * 7 - 1)

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_date.parquet"

PERIOD_WEEK_PATTERN = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]  # unchanged, just anchored to March now


def _period_lookup() -> dict[int, tuple[int, int]]:
    lookup: dict[int, tuple[int, int]] = {}
    week = 1
    for period_idx, weeks_in_period in enumerate(PERIOD_WEEK_PATTERN, start=1):
        quarter = (period_idx - 1) // 3 + 1
        for _ in range(weeks_in_period):
            lookup[week] = (period_idx, quarter)
            week += 1
    return lookup


def _black_fridays(years: range) -> set[dt.date]:
    out = set()
    for year in years:
        fridays_in_nov = [
            dt.date(year, 11, day)
            for day in range(1, 31)
            if dt.date(year, 11, day).weekday() == 4
        ]
        out.add(fridays_in_nov[3])
    return out


def _season(month: int) -> str:
    # SS = March-August, AW = September-February
    return "SS" if 3 <= month <= 8 else "AW"


def build() -> pd.DataFrame:
    all_dates = pd.date_range(START_DATE, END_DATE, freq="D")
    period_lookup = _period_lookup()
    black_fridays = _black_fridays(range(START_DATE.year, END_DATE.year + 1))

    rows = []
    for ts in all_dates:
        d = ts.date()
        days_since_start = (d - START_DATE).days
        business_year_index = days_since_start // (WEEKS_PER_BUSINESS_YEAR * 7)
        business_year_start = START_DATE + dt.timedelta(
            days=business_year_index * WEEKS_PER_BUSINESS_YEAR * 7
        )
        business_week_number = (d - business_year_start).days // 7 + 1
        business_week_number = min(business_week_number, WEEKS_PER_BUSINESS_YEAR)
        business_period_number, business_quarter = period_lookup[business_week_number]

        # sequential label, not business_year_start.year — same leap-year
        # collision risk as the very first dim_date version if derived
        # from the date directly instead
        business_year = START_DATE.year + business_year_index

        season = _season(d.month)
        # labelled by business year, not calendar year — Jan 2024 is
        # still "AW23", the second half of business year 2023, not the
        # start of a new season label
        season_label = f"{season}{business_year % 100:02d}"

        # Sunday=1 .. Saturday=7 — Python's own weekday()/isoweekday()
        # don't match what a Sunday-start retail week needs directly
        day_of_week_num = (d.weekday() + 1) % 7 + 1

        rows.append(
            {
                "date_key": int(d.strftime("%Y%m%d")),
                "full_date": d,
                "day_name": d.strftime("%A"),
                "day_of_week_num": day_of_week_num,
                "is_weekend": d.weekday() >= 5,  # Sat/Sun regardless of retail week numbering
                "day_of_month": d.day,
                "month_num": d.month,
                "month_name": d.strftime("%B"),
                "calendar_quarter": (d.month - 1) // 3 + 1,
                "calendar_year": d.year,
                "calendar_week_number": d.isocalendar()[1],
                "season": season,
                "season_label": season_label,
                "business_year": business_year,
                "business_week_number": business_week_number,
                "business_period_number": business_period_number,
                "business_period_label": f"BY{business_year % 100:02d} P{business_period_number:02d}",
                "business_quarter": business_quarter,
                "period_key": business_year * 100 + business_period_number,
                "is_business_year_start": d == business_year_start,
                "is_new_years_day": d.month == 1 and d.day == 1,
                "is_christmas_day": d.month == 12 and d.day == 25,
                "is_boxing_day": d.month == 12 and d.day == 26,
                "is_black_friday": d in black_fridays,
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"dim_date: {len(df):,} rows -> {OUTPUT_PATH}")
    print(f"business years: {sorted(df['business_year'].unique())}")
    print(f"date range: {df['full_date'].min()} -> {df['full_date'].max()}")


if __name__ == "__main__":
    main()