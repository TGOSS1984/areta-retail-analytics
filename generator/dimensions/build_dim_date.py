"""
dim_date builder.

I'm building this on a UK-style retail 4-4-5 calendar (12 periods a year,
three periods per quarter, weeks grouped 4-4-5) rather than plain calendar
months, because that's what the sales and target facts will actually report
against later. Everything else in this project joins back to fact tables
through date_key, so this has to exist before anything else does.

Known simplification: I'm not modelling Easter-based bank holidays (Good
Friday, Easter Monday, early May / spring bank holiday) because I didn't
want to hardcode movable-feast dates I couldn't verify were right. Only the
fixed-date holidays and the ones I can actually compute (Black Friday,
Boxing Day, New Year's Day) are flagged. Fine to add a proper holiday
library later if a specific visual needs the movable ones.

Usage:
    python build_dim_date.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

# --- config -----------------------------------------------------------
# First Monday on/after 1 Jan 2023, through the last Sunday of retail
# FY2026 — three prior full years plus the current one, enough for YoY
# comparisons without the row count getting silly. Change these two if
# the project's date range ever needs to move.
START_DATE = dt.date(2023, 1, 2)
END_DATE = dt.date(2026, 12, 27)

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_date.parquet"

# 4-4-5 weeks per period, 3 periods per quarter, 4 quarters = 52 weeks/year.
PERIOD_WEEK_PATTERN = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]
WEEKS_PER_RETAIL_YEAR = sum(PERIOD_WEEK_PATTERN)  # 52

SEASON_BY_MONTH = {
    12: "Winter", 1: "Winter", 2: "Winter",
    3: "Spring", 4: "Spring", 5: "Spring",
    6: "Summer", 7: "Summer", 8: "Summer",
    9: "Autumn", 10: "Autumn", 11: "Autumn",
}


def _period_lookup() -> dict[int, tuple[int, int]]:
    """retail_week_number (1-52) -> (period_number, quarter_number)."""
    lookup: dict[int, tuple[int, int]] = {}
    week = 1
    for period_idx, weeks_in_period in enumerate(PERIOD_WEEK_PATTERN, start=1):
        quarter = (period_idx - 1) // 3 + 1
        for _ in range(weeks_in_period):
            lookup[week] = (period_idx, quarter)
            week += 1
    return lookup


def _black_fridays(years: range) -> set[dt.date]:
    """4th Friday of November each year — computed, not hardcoded."""
    out = set()
    for year in years:
        fridays_in_nov = [
            dt.date(year, 11, day)
            for day in range(1, 31)
            if dt.date(year, 11, day).weekday() == 4
        ]
        out.add(fridays_in_nov[3])
    return out


def build() -> pd.DataFrame:
    all_dates = pd.date_range(START_DATE, END_DATE, freq="D")
    period_lookup = _period_lookup()
    black_fridays = _black_fridays(range(START_DATE.year, END_DATE.year + 1))

    rows = []
    for ts in all_dates:
        d = ts.date()
        days_since_start = (d - START_DATE).days
        retail_year_index = days_since_start // (WEEKS_PER_RETAIL_YEAR * 7)
        retail_year_start = START_DATE + dt.timedelta(
            days=retail_year_index * WEEKS_PER_RETAIL_YEAR * 7
        )
        retail_week_number = (d - retail_year_start).days // 7 + 1
        retail_week_number = min(retail_week_number, WEEKS_PER_RETAIL_YEAR)
        retail_period_number, retail_quarter = period_lookup[retail_week_number]

        # retail_year is a straight sequential label (START_DATE.year + index),
        # NOT retail_year_start.year — a 364-day retail year doesn't line up
        # with a 365/366-day calendar year, and I originally used
        # retail_year_start.year here. In a leap year that drifts just far
        # enough that two different 364-day blocks both start with a
        # calendar date in the same year, so they'd get the SAME retail_year
        # label and silently collide in anything that groups by it — caught
        # this because fact_stock_snapshot came out with 156 weeks instead
        # of the expected 208.
        retail_year = START_DATE.year + retail_year_index

        rows.append(
            {
                "date_key": int(d.strftime("%Y%m%d")),
                "full_date": d,
                "day_name": d.strftime("%A"),
                "day_of_week_num": d.isoweekday(),  # 1=Mon .. 7=Sun
                "is_weekend": d.isoweekday() >= 6,
                "day_of_month": d.day,
                "month_num": d.month,
                "month_name": d.strftime("%B"),
                "calendar_quarter": (d.month - 1) // 3 + 1,
                "calendar_year": d.year,
                "season": SEASON_BY_MONTH[d.month],
                "retail_year": retail_year,
                "retail_week_number": retail_week_number,
                "retail_period_number": retail_period_number,
                "retail_quarter": retail_quarter,
                # single-column key for relating to fact_targets, which is
                # at (store, retail_year, retail_period) grain — Power BI
                # relationships need one column, not a composite of two
                "period_key": retail_year * 100 + retail_period_number,
                "is_retail_year_start": d == retail_year_start,
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


if __name__ == "__main__":
    main()