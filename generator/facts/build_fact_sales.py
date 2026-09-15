"""
fact_sales builder — RAW pass.

Rebuilt after an audit against the original brief found three real gaps:
no invoice/transaction grain, margin didn't hold up at deep discount
depths, and VAT was missing entirely. All three are addressed here; two
other known gaps (multi-buy promos, actuals stopping at a "present date"
rather than running through the full future year) are deliberately NOT in
this pass — they're separable enough to risk on their own rather than
bundle into an already-large change.

Grain is now (invoice_id, line_number), not (date, store, sku). How that
works: the underlying demand simulation — which SKUs sell, how many, when,
shaped by price/season/weekday/store-strength/promo — is UNCHANGED from
the previous version and already proven. What's new is a lightweight
invoice-assignment pass afterward: each store-day's sold lines get grouped
into a variable number of transactions rather than staying as flat
independent rows. Rebuilding the whole demand engine around baskets would
have been a much bigger, riskier change for the same end result.

Margin: previously derived from dim_product's fixed cost_price_gbp, which
is mathematically impossible to reconcile with "68-74% margin at full
price, 50-60% even in deep clearance" — a fixed cost can't produce both.
Real retailers handle this by decoupling markdown margin from standard
cost (a "markdown provision" concept); this version looks up a target
margin RANGE per discount tier and samples within it, independent of
dim_product's cost. dim_product's cost_price_gbp still exists and still
means something — it's the standard/book cost fact_stock_snapshot uses
for stock valuation — it's just no longer what drives realized sale
margin here.

VAT: net_sales_gbp is now genuinely ex-VAT, with vat_gbp and
gross_sales_gbp (inc-VAT) added, using each market's vat_rate from
markets.yml.

Usage:
    python build_fact_sales.py
"""

from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

GEN_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = GEN_ROOT.parent

DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_PRODUCT_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_product.parquet"
DIM_PROMO_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_promo.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FX_RATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "fx_rate_monthly.parquet"
MARKETS_CONFIG_PATH = GEN_ROOT / "config" / "markets.yml"

OUTPUT_PATH = PROJECT_ROOT / "data" / "raw" / "fact_sales_raw.csv"

RANDOM_SEED = 99
BASE_DEMAND_SCALAR = 0.12

ASSORTMENT_SIZE = {"Retail": 350, "Concession": 120}
CHANNEL_DEMAND_MULT = {"Retail": 1.0, "Concession": 0.7}
HOME_MARKET_MULT = 1.15

# keyed to dim_date's Sunday=1..Saturday=7 numbering
WEEKDAY_MULT = {1: 1.25, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.15, 7: 1.5}

SEASON_PROFILE = {
    "Outerwear": {"peak_month": 11, "amplitude": 0.55},
    "Midlayer": {"peak_month": 10, "amplitude": 0.45},
    "Legwear": {"peak_month": 6, "amplitude": 0.25},
    "Tops": {"peak_month": 6, "amplitude": 0.40},
    "Accessories": {"peak_month": 11, "amplitude": 0.30},
    "Footwear": {"peak_month": 5, "amplitude": 0.25},
    "Camping & Equipment": {"peak_month": 6, "amplitude": 0.60},
}

PROMO_ELIGIBLE_SHARE = 0.65
PROMO_UPLIFT_FACTOR = 1.2
RETURN_RATE = 0.03

# invoice grouping — average distinct product lines per transaction.
# Matches the basket-size assumption fact_footfall used to estimate
# transactions with before this existed; keeping the same number means
# items-per-transaction doesn't jump around for no reason.
AVG_BASKET_SIZE = 1.9

# target GROSS margin range by discount tier — independent of dim_product's
# cost_price_gbp on purpose, see module docstring
MARGIN_TIER_BOUNDS = [0, 20, 30, 40, 50, 60]
MARGIN_TIER_RANGES = [
    (0.68, 0.74),  # 0% off (full price)
    (0.64, 0.70),  # up to 20% off
    (0.60, 0.68),  # up to 30% off
    (0.56, 0.64),  # up to 40% off
    (0.52, 0.60),  # up to 50% off
    (0.50, 0.58),  # up to 60% off
    (0.50, 0.56),  # 70%+ off — floors here rather than going negative
]


def _seasonal_mult(major_group: str, month: int) -> float:
    prof = SEASON_PROFILE[major_group]
    return 1 + prof["amplitude"] * np.cos(2 * np.pi * (month - prof["peak_month"]) / 12)


def _store_seed(store_id: str) -> int:
    return int(hashlib.sha256(store_id.encode()).hexdigest(), 16) % (2**32)


def _margin_bounds(discount_arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    conditions = [discount_arr <= b for b in MARGIN_TIER_BOUNDS]
    lo = np.select(conditions, [r[0] for r in MARGIN_TIER_RANGES[:-1]], default=MARGIN_TIER_RANGES[-1][0])
    hi = np.select(conditions, [r[1] for r in MARGIN_TIER_RANGES[:-1]], default=MARGIN_TIER_RANGES[-1][1])
    return lo, hi


def load_inputs():
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    dim_product = pd.read_parquet(DIM_PRODUCT_PATH)
    dim_promo = pd.read_parquet(DIM_PROMO_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)
    fx_rate = pd.read_parquet(FX_RATE_PATH)
    with open(MARKETS_CONFIG_PATH, "r", encoding="utf-8") as f:
        markets = {m["code"]: m for m in yaml.safe_load(f)["markets"]}
    return dim_store, dim_product, dim_promo, dim_date, fx_rate, markets


def build_assortment(dim_store: pd.DataFrame, dim_product: pd.DataFrame, markets: dict) -> pd.DataFrame:
    parts = []
    for store in dim_store.itertuples():
        rng = np.random.default_rng(_store_seed(store.store_id))
        n = min(ASSORTMENT_SIZE[store.channel], len(dim_product))
        picked = dim_product.iloc[rng.choice(len(dim_product), size=n, replace=False)].copy()
        picked["store_id"] = store.store_id
        picked["channel"] = store.channel
        picked["market_code"] = store.market_code
        picked["currency"] = store.currency
        picked["is_home_market"] = store.is_home_market
        picked["store_perf_factor"] = rng.uniform(0.75, 1.30)
        parts.append(picked)

    assortment = pd.concat(parts, ignore_index=True)

    elig_rng = np.random.default_rng(RANDOM_SEED)
    unique_skus = dim_product["sku"].unique()
    eligible = set(unique_skus[elig_rng.random(len(unique_skus)) < PROMO_ELIGIBLE_SHARE])
    assortment["promo_eligible"] = assortment["sku"].isin(eligible)

    assortment["price_index"] = assortment["market_code"].map(lambda c: markets[c]["price_index"])
    assortment["vat_rate"] = assortment["market_code"].map(lambda c: markets[c]["vat_rate"])

    base_rate = (
        BASE_DEMAND_SCALAR
        / np.sqrt(assortment["base_price_gbp"])
        * assortment["channel"].map(CHANNEL_DEMAND_MULT)
        * np.where(assortment["is_home_market"], HOME_MARKET_MULT, 1.0)
        * assortment["store_perf_factor"]
    )
    assortment["base_rate"] = base_rate
    return assortment


def build_promo_lookup(dim_promo: pd.DataFrame) -> dict:
    lookup = {}
    active = dim_promo[dim_promo["start_date"].notna()]
    for row in active.itertuples():
        d = row.start_date
        while d <= row.end_date:
            lookup[d] = (row.promo_id, row.discount_pct)
            d += dt.timedelta(days=1)
    return lookup


def build_fx_lookup(fx_rate: pd.DataFrame) -> dict:
    lookup = {}
    for row in fx_rate.itertuples():
        m = row.month_start
        lookup[(row.currency_code, m.year, m.month)] = row.gbp_rate
    return lookup


def precompute_season_arrays(major_group_arr: np.ndarray) -> dict:
    unique_groups = pd.unique(major_group_arr)
    result = {}
    for month in range(1, 13):
        mult_by_group = {g: _seasonal_mult(g, month) for g in unique_groups}
        result[month] = np.vectorize(mult_by_group.get)(major_group_arr)
    return result


def assign_invoices(store_id_arr: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Group a day's sold lines into a variable number of invoices per store.

    Same demand simulation as before decides WHAT sold — this only decides
    how those lines cluster into transactions. Basket sizes come out
    naturally uneven because the assignment is random within each store's
    invoice count, not because basket size is drawn directly.
    """
    unique_stores, inverse, counts = np.unique(store_id_arr, return_inverse=True, return_counts=True)
    n_invoices_per_store = np.maximum(1, np.round(counts / AVG_BASKET_SIZE)).astype(int)
    invoice_num = (rng.random(len(store_id_arr)) * n_invoices_per_store[inverse]).astype(int)
    return invoice_num


def simulate(assortment: pd.DataFrame, dim_date: pd.DataFrame, promo_lookup, fx_lookup) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_SEED + 1)
    invoice_rng = np.random.default_rng(RANDOM_SEED + 10)
    margin_rng = np.random.default_rng(RANDOM_SEED + 11)

    store_id_arr = assortment["store_id"].to_numpy()
    sku_arr = assortment["sku"].to_numpy()
    currency_arr = assortment["currency"].to_numpy()
    base_price_arr = assortment["base_price_gbp"].to_numpy()
    price_index_arr = assortment["price_index"].to_numpy()
    vat_rate_arr = assortment["vat_rate"].to_numpy()
    base_rate_arr = assortment["base_rate"].to_numpy()
    promo_eligible_arr = assortment["promo_eligible"].to_numpy()

    season_by_month = precompute_season_arrays(assortment["major_product_group"].to_numpy())

    day_frames = []
    for date_row in dim_date.itertuples():
        d = date_row.full_date
        month = date_row.month_num
        weekday_mult = WEEKDAY_MULT[date_row.day_of_week_num]
        season_arr = season_by_month[month]

        promo_info = promo_lookup.get(d)
        if promo_info is None:
            rate = base_rate_arr * season_arr * weekday_mult
        else:
            promo_id, discount_pct = promo_info
            promo_mult = np.where(promo_eligible_arr, 1 + discount_pct / 100 * PROMO_UPLIFT_FACTOR, 1.0)
            rate = base_rate_arr * season_arr * weekday_mult * promo_mult

        qty = rng.poisson(rate)
        idx = np.flatnonzero(qty > 0)
        if idx.size == 0:
            continue

        if promo_info is None:
            applied_discount = np.zeros(idx.size, dtype=int)
            applied_promo = np.full(idx.size, "PROMO0000", dtype=object)
        else:
            promo_id, discount_pct = promo_info
            elig = promo_eligible_arr[idx]
            applied_discount = np.where(elig, discount_pct, 0)
            applied_promo = np.where(elig, promo_id, "PROMO0000")

        cur = currency_arr[idx]
        fx = np.array([fx_lookup.get((c, d.year, d.month), 1.0) for c in cur])

        unit_price_gbp = base_price_arr[idx] * price_index_arr[idx]
        net_unit_price_gbp = unit_price_gbp * (1 - applied_discount / 100)
        q = qty[idx]

        net_sales_gbp = np.round(net_unit_price_gbp * q, 2)

        margin_lo, margin_hi = _margin_bounds(applied_discount)
        target_margin = margin_rng.uniform(margin_lo, margin_hi)
        cost_gbp = np.round(net_sales_gbp * (1 - target_margin), 2)

        vat = vat_rate_arr[idx]
        vat_gbp = np.round(net_sales_gbp * vat, 2)
        gross_sales_gbp = np.round(net_sales_gbp + vat_gbp, 2)

        this_store_ids = store_id_arr[idx]
        invoice_num = assign_invoices(this_store_ids, invoice_rng)
        date_str = d.strftime("%Y%m%d")
        invoice_id = np.array(
            [f"INV{date_str}-{s}-{n:03d}" for s, n in zip(this_store_ids, invoice_num)]
        )

        day_frames.append(
            pd.DataFrame(
                {
                    "date": d,
                    "store_id": this_store_ids,
                    "invoice_id": invoice_id,
                    "sku": sku_arr[idx],
                    "quantity": q,
                    "promo_id": applied_promo,
                    "discount_pct": applied_discount,
                    "unit_price_gbp": np.round(unit_price_gbp, 2),
                    "net_sales_gbp": net_sales_gbp,
                    "vat_gbp": vat_gbp,
                    "gross_sales_gbp": gross_sales_gbp,
                    "net_sales_local": np.round(net_sales_gbp * fx, 2),
                    "currency": cur,
                    "cost_gbp": cost_gbp,
                    "is_return": False,
                }
            )
        )

    df = pd.concat(day_frames, ignore_index=True)
    df["line_number"] = df.groupby(["invoice_id"]).cumcount() + 1
    return df


def add_returns(df: pd.DataFrame, end_date: dt.date, fx_lookup: dict) -> pd.DataFrame:
    """Single-unit returns on a sample of original sale rows, 3-21 days later.
    Each return gets its own invoice_id — a refund isn't part of the
    original purchase transaction."""
    rng = np.random.default_rng(RANDOM_SEED + 2)
    n_returns = int(len(df) * RETURN_RATE)
    sampled = df.sample(n=n_returns, random_state=RANDOM_SEED + 2).copy()

    unit_cost_gbp = sampled["cost_gbp"] / sampled["quantity"]
    unit_vat_gbp = sampled["vat_gbp"] / sampled["quantity"]

    offsets = rng.integers(3, 22, size=len(sampled))
    sampled["date"] = [
        min(d + dt.timedelta(days=int(off)), end_date)
        for d, off in zip(sampled["date"], offsets)
    ]

    fx = np.array(
        [fx_lookup.get((c, d.year, d.month), 1.0) for c, d in zip(sampled["currency"], sampled["date"])]
    )

    date_str = [d.strftime("%Y%m%d") for d in sampled["date"]]
    sampled["invoice_id"] = [
        f"RTN{ds}-{s}-{i:05d}" for i, (ds, s) in enumerate(zip(date_str, sampled["store_id"]))
    ]
    sampled["line_number"] = 1
    sampled["quantity"] = -1
    sampled["promo_id"] = "PROMO0000"
    sampled["discount_pct"] = 0
    sampled["net_sales_gbp"] = -sampled["unit_price_gbp"]
    sampled["vat_gbp"] = -unit_vat_gbp
    sampled["gross_sales_gbp"] = sampled["net_sales_gbp"] + sampled["vat_gbp"]
    sampled["net_sales_local"] = -sampled["unit_price_gbp"] * fx
    sampled["cost_gbp"] = -unit_cost_gbp
    sampled["is_return"] = True

    return pd.concat([df, sampled], ignore_index=True)


def inject_messiness(df: pd.DataFrame) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_SEED + 3)
    df = df.copy()

    dup_idx = df.sample(frac=0.003, random_state=RANDOM_SEED + 3).index
    df = pd.concat([df, df.loc[dup_idx]], ignore_index=True)

    lower_idx = df.sample(frac=0.03, random_state=RANDOM_SEED + 4).index
    df.loc[lower_idx, "store_id"] = df.loc[lower_idx, "store_id"].str.lower()

    ws_idx = df.sample(frac=0.02, random_state=RANDOM_SEED + 5).index
    df.loc[ws_idx, "currency"] = " " + df.loc[ws_idx, "currency"] + " "

    null_idx = df[df["promo_id"] == "PROMO0000"].sample(frac=0.05, random_state=RANDOM_SEED + 6).index
    df.loc[null_idx, "discount_pct"] = np.nan

    return df


def main() -> None:
    dim_store, dim_product, dim_promo, dim_date, fx_rate, markets = load_inputs()

    assortment = build_assortment(dim_store, dim_product, markets)
    print(f"assortment: {len(assortment):,} (store, sku) pairs")

    promo_lookup = build_promo_lookup(dim_promo)
    fx_lookup = build_fx_lookup(fx_rate)

    df = simulate(assortment, dim_date, promo_lookup, fx_lookup)
    print(f"simulated: {len(df):,} positive-quantity rows, {df['invoice_id'].nunique():,} invoices")

    df = add_returns(df, dim_date["full_date"].max(), fx_lookup)
    df = inject_messiness(df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"fact_sales_raw: {len(df):,} rows -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()