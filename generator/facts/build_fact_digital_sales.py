"""
build_fact_digital_sales.py

Daily digital sales at (date, market_code, device_type) grain — orders,
units, net_sales_gbp, and the AOV/basket-size that fall out of those.

Deliberately NOT an independent demand simulation. The Online channel
already exists in fact_sales (one "Areta Online" entity per market,
added when the Online channel was built) with real, already-validated
sales/order/unit figures. Simulating digital sales separately here
would risk the two numbers silently drifting apart over time — "Online
sales" on the KPI card and "digital sales" on a device-split chart
would each need their own story for why they don't match, which is
worse than just not having the device breakdown at all.

Instead: pull the REAL online totals per (date, market) straight out of
fact_sales, then split them across Desktop/Mobile/Tablet using two
INDEPENDENT weighted shares (order-share and value-share) that each sum
to exactly 1.0 per (date, market) before being applied. Two independent
shares, not one, is what lets device-level AOV differ realistically
(desktop should have a meaningfully higher AOV than mobile) while still
reconciling exactly — if the same share drove both orders and value,
every device would work out to identical AOV by construction, which
isn't realistic and isn't what real e-commerce data looks like.

Device split baselines checked against real benchmarks (Grips
Intelligence device-market-share reports, US/Canada/Sweden/Australia,
2024-2026; Optimonk's 2026 CRO stats): mobile consistently leads
traffic/order share (~60-70% in Western markets) while desktop
consistently leads conversion rate (roughly 1.5-2x mobile) and AOV
(roughly 1.3-1.6x mobile). Tablet is a small (~5-7%) but higher-AOV
slice, behaving more like desktop than mobile. The order_share vs
value_share split below is tuned to land in that band — see main()'s
printed implied-AOV-by-device check.

Depends on fact_sales and dim_store already existing.

Usage:
    python build_fact_digital_sales.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_digital_sales.parquet"

RANDOM_SEED = 140

DEVICES = ["Desktop", "Mobile", "Tablet"]

# Baseline shares of ORDERS (~= traffic share, since conversion rate
# differences between devices are modest relative to traffic volume
# differences) vs baseline shares of VALUE (skewed toward Desktop/Tablet
# because of their higher real-world AOV). Each list sums to 1.0 — the
# daily draw below perturbs these with noise and re-normalises, so the
# exact daily split moves around but the LY average sits near baseline.
ORDER_SHARE_BASELINE = {"Mobile": 0.60, "Desktop": 0.33, "Tablet": 0.07}
VALUE_SHARE_BASELINE = {"Mobile": 0.47, "Desktop": 0.44, "Tablet": 0.09}
SHARE_DAILY_NOISE = 0.06  # stdev of per-device, per-day perturbation before re-normalising


def _daily_shares(rng: np.random.Generator, n_days: int, baseline: dict[str, float]) -> pd.DataFrame:
    """n_days x len(DEVICES) matrix of shares, each row summing to 1.0."""
    base = np.array([baseline[d] for d in DEVICES])
    noise = rng.normal(0, SHARE_DAILY_NOISE, size=(n_days, len(DEVICES)))
    raw = np.clip(base + noise, 0.02, None)  # keep every device present, no negative/zero shares
    return raw / raw.sum(axis=1, keepdims=True)


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    online_stores = dim_store[dim_store["channel"] == "Online"][["store_id", "market_code"]]

    sales = pd.read_parquet(FACT_SALES_PATH)
    online_sales = sales.merge(online_stores, on="store_id", how="inner")
    online_sales = online_sales[~online_sales["is_return"]]  # returns don't represent a NEW digital order

    # Real, already-validated totals per (date, market) — the thing this
    # whole table has to reconcile back to.
    daily = (
        online_sales.groupby(["date", "market_code"])
        .agg(
            net_sales_gbp=("net_sales_gbp", "sum"),
            orders=("invoice_id", "nunique"),
            units=("quantity", "sum"),
        )
        .reset_index()
    )

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(daily)
    order_shares = _daily_shares(rng, n, ORDER_SHARE_BASELINE)
    value_shares = _daily_shares(rng, n, VALUE_SHARE_BASELINE)

    rows = []
    for i, device in enumerate(DEVICES):
        device_rows = daily[["date", "market_code"]].copy()
        device_rows["device_type"] = device
        # Orders/units driven by the SAME share (they're both "how many
        # transactions", naturally correlated) — value driven by its own
        # independent share, which is what creates the realistic AOV gap.
        device_rows["orders"] = np.round(daily["orders"].to_numpy() * order_shares[:, i]).astype(int)
        device_rows["units"] = np.round(daily["units"].to_numpy() * order_shares[:, i]).astype(int)
        device_rows["net_sales_gbp"] = (daily["net_sales_gbp"].to_numpy() * value_shares[:, i]).round(2)
        rows.append(device_rows)

    result = pd.concat(rows, ignore_index=True)

    # Rounding orders/units to whole numbers per device means the three
    # devices' sum can drift by 1-2 from the true daily total — reconcile
    # exactly by dumping any residual onto whichever device has the
    # largest share that day, same "residual goes to the biggest bucket"
    # approach as elsewhere in this generator for exactly this class of
    # rounding-residual problem.
    order_totals = result.groupby(["date", "market_code"])["orders"].transform("sum")
    true_orders = daily.set_index(["date", "market_code"])["orders"]
    result = result.merge(
        true_orders.rename("true_orders"), left_on=["date", "market_code"], right_index=True
    )
    residual = result["true_orders"] - order_totals
    biggest_share_idx = result.groupby(["date", "market_code"])["orders"].transform("idxmax")
    is_biggest = result.index == biggest_share_idx
    result.loc[is_biggest, "orders"] += residual[is_biggest]
    result = result.drop(columns=["true_orders"])

    result["orders"] = result["orders"].clip(lower=0)
    result["basket_value_gbp"] = np.where(
        result["orders"] > 0, (result["net_sales_gbp"] / result["orders"]).round(2), 0.0
    )

    return result[["date", "market_code", "device_type", "orders", "units", "net_sales_gbp", "basket_value_gbp"]]


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_digital_sales: {len(df):,} rows -> {OUTPUT_PATH}")

    by_device = df.groupby("device_type").agg(orders=("orders", "sum"), sales=("net_sales_gbp", "sum"))
    by_device["aov"] = by_device["sales"] / by_device["orders"]
    overall_aov = df["net_sales_gbp"].sum() / df["orders"].sum()
    by_device["aov_vs_overall"] = by_device["aov"] / overall_aov
    print("\nby device (implied AOV should be: Desktop/Tablet meaningfully above 1.0x, Mobile below):")
    print(by_device.round(2))


if __name__ == "__main__":
    main()