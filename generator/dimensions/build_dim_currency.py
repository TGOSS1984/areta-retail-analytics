"""
dim_currency builder.

Two small outputs from one script, since they're tightly coupled:
  - dim_currency.parquet    — currency reference metadata
  - fx_rate_monthly.parquet — GBP -> local currency rate, one row per
                               currency per calendar month, so fact_sales
                               can convert local sales back to GBP and the
                               report can show constant-currency vs actual
                               (useful given how many markets aren't GBP).

Currency list is read straight from markets.yml rather than hardcoded here
— one source of truth for "which currencies exist," same as dim_store
reading market weights from the same file.

Rates are a random walk around a realistic-looking anchor per currency,
clipped to a plausible band. Not real historical FX data — just enough
month-to-month movement that a currency-impact view has something to show.

Usage:
    python build_dim_currency.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import yaml

MARKETS_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "markets.yml"
CURRENCY_OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_currency.parquet"
FX_OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "fx_rate_monthly.parquet"

RANDOM_SEED = 11
REPORTING_CURRENCY = "GBP"

# matches dim_date's range
START_YEAR_MONTH = (2023, 1)
END_YEAR_MONTH = (2026, 12)

CURRENCY_META = {
    "GBP": {"name": "British Pound", "symbol": "\u00a3", "decimal_places": 2},
    "EUR": {"name": "Euro", "symbol": "\u20ac", "decimal_places": 2},
    "PLN": {"name": "Polish Zloty", "symbol": "z\u0142", "decimal_places": 2},
    "CZK": {"name": "Czech Koruna", "symbol": "K\u010d", "decimal_places": 2},
}

# anchor = units of local currency per 1 GBP. monthly_vol is the standard
# deviation of the monthly random walk step, as a fraction of the anchor.
FX_ANCHOR = {
    "EUR": {"anchor": 1.17, "monthly_vol": 0.015, "band": (1.05, 1.30)},
    "PLN": {"anchor": 5.05, "monthly_vol": 0.020, "band": (4.60, 5.60)},
    "CZK": {"anchor": 28.80, "monthly_vol": 0.020, "band": (26.50, 31.50)},
}


def month_range() -> list[pd.Timestamp]:
    start = pd.Timestamp(year=START_YEAR_MONTH[0], month=START_YEAR_MONTH[1], day=1)
    end = pd.Timestamp(year=END_YEAR_MONTH[0], month=END_YEAR_MONTH[1], day=1)
    return list(pd.date_range(start, end, freq="MS"))


def build_dim_currency(currencies_in_use: set[str]) -> pd.DataFrame:
    rows = []
    for code in sorted(currencies_in_use):
        meta = CURRENCY_META[code]
        rows.append(
            {
                "currency_code": code,
                "currency_name": meta["name"],
                "symbol": meta["symbol"],
                "decimal_places": meta["decimal_places"],
                "is_reporting_currency": code == REPORTING_CURRENCY,
            }
        )
    return pd.DataFrame(rows)


def build_fx_rates(currencies_in_use: set[str]) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_SEED)
    months = month_range()
    rows = []

    for code in sorted(currencies_in_use):
        if code == REPORTING_CURRENCY:
            for month in months:
                rows.append({"month_start": month, "currency_code": code, "gbp_rate": 1.0})
            continue

        cfg = FX_ANCHOR[code]
        rate = cfg["anchor"]
        lo, hi = cfg["band"]
        for month in months:
            rate += rng.normal(0, cfg["anchor"] * cfg["monthly_vol"])
            rate = float(np.clip(rate, lo, hi))
            rows.append({"month_start": month, "currency_code": code, "gbp_rate": round(rate, 4)})

    return pd.DataFrame(rows)


def main() -> None:
    with open(MARKETS_CONFIG_PATH, "r", encoding="utf-8") as f:
        markets = yaml.safe_load(f)["markets"]
    currencies_in_use = {m["currency"] for m in markets}

    dim_currency = build_dim_currency(currencies_in_use)
    fx_rates = build_fx_rates(currencies_in_use)

    CURRENCY_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    dim_currency.to_parquet(CURRENCY_OUTPUT_PATH, index=False)
    fx_rates.to_parquet(FX_OUTPUT_PATH, index=False)

    print(f"dim_currency: {len(dim_currency)} rows -> {CURRENCY_OUTPUT_PATH}")
    print(f"fx_rate_monthly: {len(fx_rates)} rows -> {FX_OUTPUT_PATH}")


if __name__ == "__main__":
    main()