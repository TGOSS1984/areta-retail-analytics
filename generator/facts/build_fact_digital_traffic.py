"""
build_fact_digital_traffic.py

Daily digital traffic at (date, market_code, device_type, browser)
grain — visitors, sessions, page_views.

Unlike fact_digital_sales, there's no existing figure this has to
reconcile against (nothing in this project tracks "sessions" anywhere
else), so this IS an independent simulation — but calibrated so the
implied conversion rate (orders from fact_digital_sales / sessions
here) lands in a realistic band per device, the same "derive sessions
from a conversion-rate draw" approach build_fact_footfall.py uses for
footfall vs transactions.

Conversion rate baselines checked against the same real benchmarks
used for the device-split shares in build_fact_digital_sales.py (Grips
Intelligence, Optimonk 2026): desktop consistently converts highest
(~2.0-2.7% across the markets checked), mobile lowest (~1.4-2.0%),
tablet in between. Sessions-per-visitor (most visitors have exactly one
session per day) and pages-per-session are standard, uncontroversial
web-analytics figures, not specifically sourced.

Browser split by device is a reasonable extrapolation from well-known,
uncontested browser market-share facts rather than a specific citation:
Chrome dominant everywhere; Safari's share is almost entirely
mobile/tablet (iOS default browser); Edge and Firefox are desktop-
skewed (near-zero on mobile, where iOS doesn't allow a different
rendering engine and Android defaults to Chrome).

Depends on fact_digital_sales already existing (for the orders figure
each device's conversion rate is calibrated against) and dim_date.

Usage:
    python build_fact_digital_traffic.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_DIGITAL_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_digital_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_digital_traffic.parquet"

RANDOM_SEED = 141
PRESENT_DATE_OVERRIDE: dt.date | None = None


def present_date() -> dt.date:
    return PRESENT_DATE_OVERRIDE or dt.date.today()


CONVERSION_BASELINE = {"Desktop": 0.024, "Tablet": 0.024, "Mobile": 0.016}
CONVERSION_DAILY_NOISE = 0.004

SESSIONS_PER_VISITOR_BASELINE = 1.15  # most visitors have exactly one session/day, some have 2+
PAGES_PER_SESSION_BASELINE = {"Desktop": 5.2, "Tablet": 4.6, "Mobile": 3.4}  # smaller screens -> fewer pages
PAGES_DAILY_NOISE = 0.6

BROWSER_SHARE_BY_DEVICE = {
    "Desktop": {"Chrome": 0.62, "Edge": 0.16, "Firefox": 0.09, "Safari": 0.07, "Other": 0.06},
    "Mobile": {"Chrome": 0.56, "Safari": 0.35, "Other": 0.05, "Firefox": 0.02, "Edge": 0.02},
    "Tablet": {"Safari": 0.46, "Chrome": 0.44, "Other": 0.06, "Firefox": 0.02, "Edge": 0.02},
}


def build() -> pd.DataFrame:
    digital_sales = pd.read_parquet(FACT_DIGITAL_SALES_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)[["full_date"]].rename(columns={"full_date": "date"})
    digital_sales = digital_sales[digital_sales["date"] <= present_date()]

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(digital_sales)

    conv_baseline = digital_sales["device_type"].map(CONVERSION_BASELINE).to_numpy()
    conv_noise = rng.normal(0, CONVERSION_DAILY_NOISE, size=n)
    conversion_draw = np.clip(conv_baseline + conv_noise, 0.004, 0.06)

    sessions = np.where(
        digital_sales["orders"] > 0,
        np.round(digital_sales["orders"] / conversion_draw),
        rng.integers(20, 300, size=n),  # quiet days still get some browsing with zero orders
    ).astype(int)

    sessions_per_visitor = np.clip(
        rng.normal(SESSIONS_PER_VISITOR_BASELINE, 0.08, size=n), 1.02, 1.6
    )
    visitors = np.maximum(1, np.round(sessions / sessions_per_visitor)).astype(int)

    pages_baseline = digital_sales["device_type"].map(PAGES_PER_SESSION_BASELINE).to_numpy()
    pages_per_session = np.clip(rng.normal(pages_baseline, PAGES_DAILY_NOISE, size=n), 1.5, None)
    page_views = np.round(sessions * pages_per_session).astype(int)

    base = digital_sales[["date", "market_code", "device_type"]].copy()
    base["sessions"] = sessions
    base["visitors"] = visitors
    base["page_views"] = page_views

    # Split each (date, market, device) row across browsers using that
    # device's browser-share table, rounded with the same
    # residual-to-the-biggest-bucket reconciliation as fact_digital_sales
    # so sessions/visitors/page_views sum EXACTLY back to the device-level
    # totals above, not just approximately.
    rows = []
    for device, shares in BROWSER_SHARE_BY_DEVICE.items():
        device_base = base[base["device_type"] == device]
        browsers = list(shares.keys())
        share_arr = np.array([shares[b] for b in browsers])
        noise = rng.normal(0, 0.03, size=(len(device_base), len(browsers)))
        raw = np.clip(share_arr + noise, 0.005, None)
        norm_shares = raw / raw.sum(axis=1, keepdims=True)

        for metric in ["sessions", "visitors", "page_views"]:
            device_base = device_base.copy()
            values = device_base[metric].to_numpy()
            per_browser = np.round(values[:, None] * norm_shares).astype(int)
            residual = values - per_browser.sum(axis=1)
            biggest = per_browser.argmax(axis=1)
            per_browser[np.arange(len(per_browser)), biggest] += residual
            device_base[[f"{metric}__{b}" for b in browsers]] = per_browser

        for b in browsers:
            browser_rows = device_base[["date", "market_code", "device_type"]].copy()
            browser_rows["browser"] = b
            browser_rows["sessions"] = device_base[f"sessions__{b}"]
            browser_rows["visitors"] = device_base[f"visitors__{b}"]
            browser_rows["page_views"] = device_base[f"page_views__{b}"]
            rows.append(browser_rows)

    result = pd.concat(rows, ignore_index=True)
    return result[["date", "market_code", "device_type", "browser", "visitors", "sessions", "page_views"]]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_digital_traffic: {len(df):,} rows -> {OUTPUT_PATH}")

    digital_sales = pd.read_parquet(FACT_DIGITAL_SALES_PATH)
    by_device = df.groupby("device_type")["sessions"].sum()
    orders_by_device = digital_sales.groupby("device_type")["orders"].sum()
    conv = (orders_by_device / by_device).round(4)
    print("\nimplied conversion rate by device (should be ~1.6-2.7%):")
    print(conv)

    browser_share = df.groupby("browser")["sessions"].sum()
    print("\noverall browser share:")
    print((browser_share / browser_share.sum()).round(3).sort_values(ascending=False))


if __name__ == "__main__":
    main()