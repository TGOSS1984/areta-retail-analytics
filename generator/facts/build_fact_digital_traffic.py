"""
build_fact_digital_traffic.py

Daily digital traffic at (date, market_code, device_type, browser)
grain: visitors, sessions, page_views, and the shopping funnel
(product_view_sessions, basket_sessions, checkout_sessions,
order_sessions). Each stage is at most the one before it, and
order_sessions adds up to fact_digital_sales orders, so the funnel ends
exactly where the conversion rate does.

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


# --- the shopping funnel ---------------------------------------------------
# Every session either orders or drops out somewhere along the way:
#
#   sessions -> viewed a product -> added to basket -> reached checkout -> ordered
#
# I build the funnel from three rates per device, and conversion is simply
# their product: add-to-basket rate x basket-to-checkout rate x checkout
# completion rate. Orders are fixed (they come from fact_digital_sales), so
# everything is worked backwards from them: checkout sessions = orders /
# completion, basket sessions = checkout / basket-to-checkout, sessions =
# basket / add-to-basket. Product views sit between sessions and baskets.
#
# Before the redesign below, the rates multiply out to the conversion
# baselines I'd used since the start (about 2.4% on desktop and tablet, 1.6%
# on mobile), so the funnel is a breakdown of the same conversion, not a
# new one. The rates themselves are typical published e-commerce figures,
# not from one source: desktop adds to basket on roughly 9-10% of sessions
# and mobile on 7-8%; basket abandonment sits in the 70-80% range (Baymard's
# long-running average is about 70%), higher on mobile; and about half of
# checkouts don't complete.
ADD_TO_BASKET_RATE = {"Desktop": 0.095, "Tablet": 0.090, "Mobile": 0.075}
BASKET_TO_CHECKOUT_RATE = {"Desktop": 0.46, "Tablet": 0.48, "Mobile": 0.43}
CHECKOUT_COMPLETION_RATE = {"Desktop": 0.55, "Tablet": 0.56, "Mobile": 0.50}
PRODUCT_VIEW_RATE = {"Desktop": 0.62, "Tablet": 0.58, "Mobile": 0.52}

# Two changes over time, so the funnel KPIs have a year-on-year story.
#
# A one-page checkout with express payment launches in spring 2025 and beds
# in over four weeks. Checkout completion goes up, most of all on mobile,
# where typing card details on a phone was where people gave up. Because
# orders are fixed, better completion means fewer sessions were needed for
# the same orders, so the conversion rate rises and both abandonment rates
# fall. Add-to-basket doesn't move, which is right: a checkout change can't
# make people put more in their basket.
CHECKOUT_REDESIGN_START = dt.date(2025, 4, 14)
CHECKOUT_REDESIGN_RAMP_DAYS = 28
CHECKOUT_REDESIGN_UPLIFT = {"Desktop": 0.025, "Tablet": 0.025, "Mobile": 0.04}  # points of completion
# Mobile add-to-basket improves steadily as the mobile site gets better, about
# 2% a year relative, from the start of the data.
#
# Both changes lift conversion, and with orders fixed that means fewer
# sessions per order. I kept them modest so traffic still grows a little
# alongside sales; a bigger uplift made 2025 sessions fall while sales rose,
# which reads as a traffic problem rather than a better checkout.
MOBILE_BASKET_TREND_PER_YEAR = 0.02
TREND_START = dt.date(2023, 3, 5)

# Day-to-day wobble, as a fraction of each rate.
ADD_TO_BASKET_NOISE = 0.08
BASKET_TO_CHECKOUT_NOISE = 0.04
CHECKOUT_COMPLETION_NOISE = 0.04
PRODUCT_VIEW_NOISE = 0.03

SESSIONS_PER_VISITOR_BASELINE = 1.15  # most visitors have exactly one session/day, some have 2+
PAGES_PER_SESSION_BASELINE = {"Desktop": 5.2, "Tablet": 4.6, "Mobile": 3.4}  # smaller screens -> fewer pages
PAGES_DAILY_NOISE = 0.6

BROWSER_SHARE_BY_DEVICE = {
    "Desktop": {"Chrome": 0.62, "Edge": 0.16, "Firefox": 0.09, "Safari": 0.07, "Other": 0.06},
    "Mobile": {"Chrome": 0.56, "Safari": 0.35, "Other": 0.05, "Firefox": 0.02, "Edge": 0.02},
    "Tablet": {"Safari": 0.46, "Chrome": 0.44, "Other": 0.06, "Firefox": 0.02, "Edge": 0.02},
}

FUNNEL_COLUMNS = ["product_view_sessions", "basket_sessions", "checkout_sessions", "order_sessions"]


def redesign_progress(dates: pd.Series) -> np.ndarray:
    """0 before the checkout redesign, rising linearly to 1 over the ramp."""
    days = (pd.to_datetime(dates) - pd.Timestamp(CHECKOUT_REDESIGN_START)).dt.days.to_numpy()
    return np.clip(days / CHECKOUT_REDESIGN_RAMP_DAYS, 0.0, 1.0)


def split_exact(values: np.ndarray, shares: np.ndarray) -> np.ndarray:
    """Split each value across columns by shares, in whole numbers that add back exactly.

    Largest-remainder rounding: floor everything, then hand the leftover units
    to the biggest fractional parts. Unlike rounding and pushing the residual
    onto the biggest bucket, nothing can go negative.
    """
    raw = values[:, None] * shares
    out = np.floor(raw).astype(np.int64)
    leftover = (values - out.sum(axis=1)).astype(np.int64)
    order = np.argsort(-(raw - out), axis=1)
    for k in range(shares.shape[1]):
        take = leftover > k
        out[np.where(take)[0], order[take, k]] += 1
    return out


def build() -> pd.DataFrame:
    digital_sales = pd.read_parquet(FACT_DIGITAL_SALES_PATH)
    digital_sales = digital_sales[digital_sales["date"] <= present_date()].reset_index(drop=True)

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(digital_sales)
    device = digital_sales["device_type"]
    orders = digital_sales["orders"].to_numpy()

    def rate(table, noise):
        return device.map(table).to_numpy() * (1 + rng.normal(0, noise, size=n))

    years_in = (pd.to_datetime(digital_sales["date"]) - pd.Timestamp(TREND_START)).dt.days.to_numpy() / 365.25
    mobile_trend = np.where(device == "Mobile", (1 + MOBILE_BASKET_TREND_PER_YEAR) ** years_in, 1.0)

    add_to_basket = np.clip(rate(ADD_TO_BASKET_RATE, ADD_TO_BASKET_NOISE) * mobile_trend, 0.02, 0.25)
    to_checkout = np.clip(rate(BASKET_TO_CHECKOUT_RATE, BASKET_TO_CHECKOUT_NOISE), 0.2, 0.8)
    completion = rate(CHECKOUT_COMPLETION_RATE, CHECKOUT_COMPLETION_NOISE)
    completion = np.clip(
        completion + device.map(CHECKOUT_REDESIGN_UPLIFT).to_numpy() * redesign_progress(digital_sales["date"]),
        0.2,
        0.9,
    )
    product_view = np.clip(rate(PRODUCT_VIEW_RATE, PRODUCT_VIEW_NOISE), 0.3, 0.9)

    # Work back from orders. Each stage is at least the one after it.
    checkout = np.maximum(orders, np.round(orders / completion)).astype(np.int64)
    basket = np.maximum(checkout, np.round(checkout / to_checkout)).astype(np.int64)
    sessions = np.round(basket / add_to_basket).astype(np.int64)
    # Quiet days with no orders still get some browsing, and some of it gets
    # as far as a basket or a checkout without buying. Only Tablet has these
    # (about one market-day in five), and a Tablet day with one order is only
    # about 40-60 sessions, so a quiet day is 10-60. It used to be 20-300,
    # which gave Tablet more traffic on days it sold nothing than on days it
    # did, and pulled its conversion and abandonment rates well out of line.
    quiet = orders == 0
    sessions[quiet] = rng.integers(10, 60, size=quiet.sum())
    basket[quiet] = np.round(sessions[quiet] * add_to_basket[quiet])
    checkout[quiet] = np.round(basket[quiet] * to_checkout[quiet])
    sessions = np.maximum(sessions, basket)
    product_views = np.clip(np.round(sessions * product_view).astype(np.int64), basket, sessions)

    # Drawn per device row and applied to each browser's own sessions after the
    # split, so every browser row has sessions >= visitors and page views >=
    # sessions. Splitting visitors separately used to leave a few rows with
    # more visitors than sessions (the old VAL-19 warning).
    sessions_per_visitor = np.clip(rng.normal(SESSIONS_PER_VISITOR_BASELINE, 0.08, size=n), 1.02, 1.6)
    pages_baseline = device.map(PAGES_PER_SESSION_BASELINE).to_numpy()
    pages_per_session = np.clip(rng.normal(pages_baseline, PAGES_DAILY_NOISE, size=n), 1.5, None)

    base = digital_sales[["date", "market_code", "device_type"]].copy()

    # Split each (date, market, device) row across browsers using that
    # device's browser-share table, in whole numbers that add back exactly to
    # the device totals. The funnel is split stage by stage as increments
    # (orders, then checkout minus orders, and so on) and added back up, so
    # every browser row keeps the funnel in order as well as the totals, and
    # order_sessions still reconciles to fact_digital_sales orders.
    stages = np.column_stack([orders, checkout, basket, product_views, sessions])
    increments = np.diff(np.column_stack([np.zeros(n, dtype=np.int64), stages]), axis=1)

    rows = []
    for dev, shares in BROWSER_SHARE_BY_DEVICE.items():
        mask = (device == dev).to_numpy()
        browsers = list(shares.keys())
        share_arr = np.array([shares[b] for b in browsers])
        noise = rng.normal(0, 0.03, size=(mask.sum(), len(browsers)))
        raw = np.clip(share_arr + noise, 0.005, None)
        norm_shares = raw / raw.sum(axis=1, keepdims=True)

        stage_split = np.cumsum(
            np.stack([split_exact(increments[mask, i], norm_shares) for i in range(stages.shape[1])], axis=2), axis=2
        )  # rows x browsers x [order, checkout, basket, product view, sessions]

        for j, b in enumerate(browsers):
            browser_rows = base.loc[mask, ["date", "market_code", "device_type"]].copy()
            browser_rows["browser"] = b
            browser_sessions = stage_split[:, j, 4]
            browser_rows["visitors"] = np.minimum(
                browser_sessions, np.maximum(1, np.round(browser_sessions / sessions_per_visitor[mask]))
            ).astype(np.int64)
            browser_rows["sessions"] = browser_sessions
            browser_rows["page_views"] = np.round(browser_sessions * pages_per_session[mask]).astype(np.int64)
            browser_rows["product_view_sessions"] = stage_split[:, j, 3]
            browser_rows["basket_sessions"] = stage_split[:, j, 2]
            browser_rows["checkout_sessions"] = stage_split[:, j, 1]
            browser_rows["order_sessions"] = stage_split[:, j, 0]
            rows.append(browser_rows)

    result = pd.concat(rows, ignore_index=True)
    return result[["date", "market_code", "device_type", "browser", "visitors", "sessions", "page_views", *FUNNEL_COLUMNS]]


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

    funnel = df.groupby("device_type")[["sessions", *FUNNEL_COLUMNS]].sum()
    print("\nfunnel by device, % of sessions:")
    print((funnel.div(funnel["sessions"], axis=0) * 100).round(2))

    browser_share = df.groupby("browser")["sessions"].sum()
    print("\noverall browser share:")
    print((browser_share / browser_share.sum()).round(3).sort_values(ascending=False))


if __name__ == "__main__":
    main()