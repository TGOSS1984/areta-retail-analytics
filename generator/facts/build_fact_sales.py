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

# Actuals stop here — anything after this date hasn't "happened" yet in
# the story, so no sales/footfall/stock data gets generated for it.
# Defaults to real today() so a scheduled refresh naturally extends the
# actuals frontier week by week; override for a fixed test run.
PRESENT_DATE_OVERRIDE: dt.date | None = None


def present_date() -> dt.date:
    return PRESENT_DATE_OVERRIDE or dt.date.today()
BASE_DEMAND_SCALAR = 0.12

# Online carries a wider assortment than any single physical store (no
# shelf-space constraint) but nowhere near the full ~12k-SKU catalogue —
# first attempt at 2500 (mult correspondingly ~9.5x) blew both memory
# and the target revenue share, because demand is a Poisson draw per
# (store, sku) per day: assortment size and the multiplier compound,
# they don't add. 1000 keeps the total (store, sku) pair count for
# Online (11,000) in the same order as Concession's (17,760).
ASSORTMENT_SIZE = {"Retail": 350, "Concession": 120, "Online": 1000}

# Calibrated against the existing validated Retail+Concession volume,
# not guessed: weighted pairs (assortment_size x mult, summed across all
# stores) for Retail+Concession is ~83,100; targeting Online at ~20% of
# total network sales (typical for outdoor/apparel multichannel
# retailers, mid of the realistic 15-25% band) means Online's own
# weighted pairs need to land near ~20,800 — at 11,000 pairs that's a
# mult of ~1.9. Same "tuned by checking the actual resulting % after
# running" approach as the rest of this module — see the actual printed
# channel split in main() below, re-tune here if it drifts from target.
CHANNEL_DEMAND_MULT = {"Retail": 1.0, "Concession": 0.7, "Online": 1.9}
HOME_MARKET_MULT = 1.15

# Areta is the flagship/parent brand and Tom wants it reading as the
# largest brand with real bestseller variety, not a total sweep of the
# top-N list. Before this, Areta's larger assortment (same genders/
# divisions as Basecamp) was being outweighed by Kestrel Ridge's
# premium price_index (1.45) — demand scales as 1/sqrt(price), not
# 1/price, so a higher-priced brand loses proportionally less volume
# than it gains in per-unit revenue, letting Kestrel Ridge (smaller
# range) punch above its assortment size.
#
# Calibrated iteratively by checking BOTH the actual resulting brand
# share AND top-20 composition after running (1.3/1.6/2.0/2.5/2.8/3.5
# all tried) — not derived algebraically. Found a genuine structural
# tension, not just an uncalibrated number: Areta's assortment is
# meaningfully bigger than the other 3 brands', so even a modest
# multiplier compounds with basic order statistics (bigger sample ->
# higher max) to sweep the ENTIRE top-20 with Areta styles well before
# aggregate share crosses 50% — the crossover from "some competitor
# variety" to "total sweep" sits between 1.3x and 1.6x, while 50%+
# aggregate share needs ~2.5x+. Tom chose variety over the 50% floor:
# 1.3x lands Areta as the clear largest brand (~34% vs each competitor's
# ~19-23%) with real top-20 variety (14/20 Areta, 6/20 Kestrel Ridge)
# rather than a complete sweep. If "Areta >=50% AND real top-20 variety"
# is ever wanted simultaneously, a flat per-brand multiplier can't do
# it — would need a non-uniform adjustment targeting Areta's very top
# performers specifically (e.g. diminishing the boost as an individual
# style's own demand rises), not attempted here.
BRAND_DEMAND_MULT = {"Areta": 1.3, "Kestrel Ridge": 1.0, "Basecamp": 1.0, "Areta Pro": 1.0}

# Tom wants more variety in the top-N bestseller list specifically —
# Boots was taking 11 of the top 20 individual style/colour slots even
# though it isn't even the single largest product_group by AGGREGATE
# sales (Softshell is, at #1) — the same "individual styles can crowd
# the very top ranks without dominating the aggregate" effect already
# seen with brand share. Defaults to 1.0 (no change) for every
# product_group not named here.
#
# Calibrated iteratively (four rounds), same discipline as
# BRAND_DEMAND_MULT — checked the real resulting top-20 composition
# after each run, not derived algebraically. First attempt (Boots 0.5,
# Shell 2.2, Fleece 2.5) badly overcorrected: Waterproof Shell swept
# ALL 20 slots and Fleece didn't appear even ONCE despite the highest
# multiplier — same order-statistics sensitivity as brand share, small
# multipliers have outsized effects on which styles reach the very top.
# Dialled back hard from there. Fleece needed a much bigger relative
# lift than Boots/Shell throughout, because its aggregate base is
# smaller (~£4.5M vs Shell's ~£8.0M) — at the multiplier that gave
# Boots/Shell good variety, Fleece STILL didn't appear at all; only
# broke through once pushed to 2.0 specifically. That result gave real
# top-20 variety, but the AGGREGATE category mix was still unrealistic
# — Softshell was the single biggest product_group overall (~£12.9M),
# ahead of Waterproof Shell, Waterproof Insulated Jacket, and Boots,
# which isn't how real outdoor/mountain apparel sales break down.
#
# Second pass, checked against real industry research (Grand View/
# Mordor/GM Insights/Business Research Insights market reports on
# outdoor apparel, 2025-2026) rather than guessed: topwear/jackets
# consistently reported as the largest category (51-54.5% of apparel
# revenue), waterproof/technical jackets specifically the leading
# sub-segment (24-41% of apparel sales depending on the report's
# definition), insulated jackets a standout at ~26%, thermal wear/
# fleece ~27%, and boots specifically ~49% of footwear demand (ahead of
# shoes) — with softshell never once called out as a leading category
# in any report checked; it's a supporting/transitional piece, not a
# hero product. Re-tuned to match that shape: pushed Waterproof Shell
# and Waterproof Insulated Jacket up, pulled Softshell down hard, and
# nudged Boots up (it had been pulled down to fix the EARLIER top-20-
# sweep problem, but that overshot — real data says boots should lead
# footwear, not trail behind shoes). Took a second round of iteration
# to find values giving BOTH a realistic aggregate ordering (Shell >
# Fleece > Insulated Jacket > Boots > ... > Softshell, checked against
# the actual output) AND some top-20 variety across 4 different product
# groups, rather than the aggregate-realistic version alone (which
# swept the top-20 down to just 2 categories on the first try).
PRODUCT_GROUP_DEMAND_MULT: dict[str, float] = {
    "Boots": 1.2,
    "Waterproof Shell": 1.5,
    "Waterproof Insulated Jacket": 1.35,
    "Fleece": 2.1,
    "Softshell": 0.5,
}

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

# --- multi-buy promos -------------------------------------------------
# A genuinely different mechanic from the %-off promo calendar above:
# these run as standing category pushes across defined month windows, not
# tied to the seasonal clearance events, and only kick in when a BASKET
# happens to contain enough qualifying items together — this is why it's
# a separate post-processing pass over whole invoices rather than
# something the per-line demand loop can decide on its own. Only applies
# to lines that aren't already on a %-off promo that day; multi-buy and
# clearance don't stack, they're two different kinds of promotional
# activity (see the "can be considered full price sales at higher
# margins" framing in the brief for shallower discounts vs true clearance).
MULTIBUY_SCHEMES = [
    {
        "scheme_id": "MB001",
        "product_groups": ["Fleece", "T-Shirts"],
        "mechanic": "bundle_price",
        "qty_required": 2,
        "bundle_price_gbp": 30.0,
        "months": {3, 4, 5, 9, 10, 11},  # spring and autumn category pushes
    },
    {
        "scheme_id": "MB002",
        "product_groups": ["Hats", "Gloves", "Scarves", "Socks", "Accessory Sets"],
        "mechanic": "cheapest_free",
        "qty_required": 3,
        "months": {10, 11, 12},  # gifting season
    },
]

# How often a single qualifying purchase gets a companion item added to
# complete the multi-buy, representing a customer actually taking the
# deal rather than two unrelated purchases coincidentally landing in the
# same basket. Different per product group deliberately — a cheap,
# easy add-on like a t-shirt converts to "grab a second one" far more
# readily than a pricier fleece, and accessories need three items not two,
# a meaningfully higher bar. Tuned by checking the actual resulting
# category-level % after running, not derived algebraically.
ATTACH_PROBABILITY = {
    "MB001": {"Fleece": 0.10, "T-Shirts": 0.22},
    "MB002": 0.09,
}

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
        * assortment["brand_name"].map(BRAND_DEMAND_MULT)
        * assortment["product_group"].map(PRODUCT_GROUP_DEMAND_MULT).fillna(1.0)
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


def synthesize_multibuy_attachments(
    df: pd.DataFrame,
    dim_product: pd.DataFrame,
    assortment: pd.DataFrame,
    fx_lookup: dict,
) -> pd.DataFrame:
    """Adds a companion line item to some share of single-item qualifying
    purchases, so multi-buy prevalence reflects genuine uptake — a
    customer picking up a second item specifically because of the offer —
    rather than only the rate at which two unrelated purchases happen to
    coincide in the same basket by chance. That coincidental rate alone
    came out under 1% on the first pass, nowhere near what a genuinely
    promoted "2 for £30" actually drives in real apparel retail.

    Companion lines are priced at normal full price using the same
    formula the main simulation uses. apply_multibuy_promos, run right
    after this, then groups and reprices the now-completed basket exactly
    the same way it already handles organic co-occurrence — this function
    only decides which baskets get topped up, not how they get priced.
    """
    df = df.merge(dim_product[["sku", "product_group"]], on="sku", how="left")
    df["month"] = pd.DatetimeIndex(df["date"]).month

    rng = np.random.default_rng(RANDOM_SEED + 20)
    market_lookup = assortment.drop_duplicates("store_id").set_index("store_id")[["price_index", "vat_rate"]]

    new_row_frames = []
    for scheme in MULTIBUY_SCHEMES:
        for pg in scheme["product_groups"]:
            prob_cfg = ATTACH_PROBABILITY[scheme["scheme_id"]]
            prob = prob_cfg[pg] if isinstance(prob_cfg, dict) else prob_cfg

            candidates = df[
                (df["product_group"] == pg)
                & (df["month"].isin(scheme["months"]))
                & (df["promo_id"] == "PROMO0000")
                & (~df["is_return"])
            ]
            if candidates.empty:
                continue

            attach_mask = rng.random(len(candidates)) < prob
            attaching = candidates[attach_mask]
            if attaching.empty:
                continue

            pool = dim_product[dim_product["product_group"] == pg]
            n_companions_needed = scheme["qty_required"] - 1

            for _ in range(n_companions_needed):
                companion_skus = pool.sample(
                    n=len(attaching), replace=True, random_state=int(rng.integers(1_000_000_000))
                ).reset_index(drop=True)
                companion_rows = attaching[["date", "store_id", "invoice_id", "currency"]].reset_index(drop=True).copy()
                companion_rows["sku"] = companion_skus["sku"].to_numpy()
                companion_rows["base_price_gbp"] = companion_skus["base_price_gbp"].to_numpy()
                new_row_frames.append(companion_rows)

    df = df.drop(columns=["product_group", "month"])
    if not new_row_frames:
        return df

    companions = pd.concat(new_row_frames, ignore_index=True)
    companions = companions.merge(market_lookup, on="store_id", how="left")

    fx = np.array(
        [fx_lookup.get((c, d.year, d.month), 1.0) for c, d in zip(companions["currency"], companions["date"])]
    )
    companions["quantity"] = 1
    companions["promo_id"] = "PROMO0000"
    companions["discount_pct"] = 0
    companions["unit_price_gbp"] = np.round(companions["base_price_gbp"] * companions["price_index"], 2)
    companions["net_sales_gbp"] = companions["unit_price_gbp"]
    companions["vat_gbp"] = np.round(companions["net_sales_gbp"] * companions["vat_rate"], 2)
    companions["gross_sales_gbp"] = companions["net_sales_gbp"] + companions["vat_gbp"]
    companions["net_sales_local"] = np.round(companions["net_sales_gbp"] * fx, 2)

    margin_rng = np.random.default_rng(RANDOM_SEED + 21)
    full_price_lo, full_price_hi = MARGIN_TIER_RANGES[0]
    target_margin = margin_rng.uniform(full_price_lo, full_price_hi, size=len(companions))
    companions["cost_gbp"] = np.round(companions["net_sales_gbp"] * (1 - target_margin), 2)
    companions["is_return"] = False

    companions = companions[df.columns.drop("line_number")]
    combined = pd.concat([df, companions], ignore_index=True)
    combined["line_number"] = combined.groupby("invoice_id").cumcount() + 1
    return combined


def apply_multibuy_promos(df: pd.DataFrame, dim_product: pd.DataFrame) -> pd.DataFrame:
    """Post-processing pass over completed invoices — finds baskets that
    qualify for a multi-buy scheme and adjusts pricing on the qualifying
    lines. Runs after the main simulation, before returns/messiness;
    multi-buys apply to genuine purchases only.

    Order matters here: implied VAT rate and FX rate are captured from
    each row BEFORE net_sales_gbp gets overwritten, then reapplied to the
    new value afterward — got this wrong exactly this way once already
    on the returns logic (dividing two already-overwritten columns), so
    doing it in the right order deliberately this time.
    """
    df = df.merge(dim_product[["sku", "product_group"]], on="sku", how="left")
    df["month"] = pd.DatetimeIndex(df["date"]).month

    pg_month_rows = [
        {"product_group": pg, "month": m, "multibuy_scheme_id": scheme["scheme_id"]}
        for scheme in MULTIBUY_SCHEMES
        for pg in scheme["product_groups"]
        for m in scheme["months"]
    ]
    pg_month_lookup = pd.DataFrame(pg_month_rows)

    df = df.merge(pg_month_lookup, on=["product_group", "month"], how="left")
    df.loc[df["promo_id"] != "PROMO0000", "multibuy_scheme_id"] = None  # %-off takes precedence

    eligible = df[df["multibuy_scheme_id"].notna()].copy()
    if eligible.empty:
        return df.drop(columns=["product_group", "month", "multibuy_scheme_id"])

    scheme_by_id = {s["scheme_id"]: s for s in MULTIBUY_SCHEMES}
    grp_cols = ["invoice_id", "multibuy_scheme_id"]
    eligible["group_qty"] = eligible.groupby(grp_cols)["quantity"].transform("sum")
    eligible["group_revenue"] = eligible.groupby(grp_cols)["net_sales_gbp"].transform("sum")
    eligible["qty_required"] = eligible["multibuy_scheme_id"].map(lambda s: scheme_by_id[s]["qty_required"])
    eligible["mechanic"] = eligible["multibuy_scheme_id"].map(lambda s: scheme_by_id[s]["mechanic"])
    eligible["bundle_price_gbp"] = eligible["multibuy_scheme_id"].map(
        lambda s: scheme_by_id[s].get("bundle_price_gbp", 0.0)
    )

    eligible = eligible[eligible["group_qty"] >= eligible["qty_required"]].copy()
    if eligible.empty:
        return df.drop(columns=["product_group", "month", "multibuy_scheme_id"])

    num_bundles = eligible["group_qty"] // eligible["qty_required"]
    remainder_qty = eligible["group_qty"] - num_bundles * eligible["qty_required"]
    avg_unit_price = eligible["group_revenue"] / eligible["group_qty"]

    is_bundle = eligible["mechanic"] == "bundle_price"
    new_group_revenue = np.where(
        is_bundle,
        num_bundles * eligible["bundle_price_gbp"] + remainder_qty * avg_unit_price,
        eligible["group_revenue"] - num_bundles * avg_unit_price,  # cheapest_free, approximated as group average
    )
    new_group_revenue = np.maximum(new_group_revenue, 0.0)
    ratio = np.where(eligible["group_revenue"] > 0, new_group_revenue / eligible["group_revenue"], 1.0)

    idx = eligible.index
    # capture implied VAT and FX rates from the ORIGINAL values before anything gets overwritten
    vat_rate_implied = (df.loc[idx, "vat_gbp"] / df.loc[idx, "net_sales_gbp"].replace(0, np.nan)).fillna(0)
    fx_rate_implied = (df.loc[idx, "net_sales_local"] / df.loc[idx, "net_sales_gbp"].replace(0, np.nan)).fillna(1)
    original_full_price = df.loc[idx, "unit_price_gbp"] * df.loc[idx, "quantity"]

    new_net_sales_gbp = np.round(df.loc[idx, "net_sales_gbp"].to_numpy() * ratio, 2)
    df.loc[idx, "net_sales_gbp"] = new_net_sales_gbp
    df.loc[idx, "promo_id"] = "MULTIBUY-" + eligible["multibuy_scheme_id"]

    implied_discount = np.clip(np.round((1 - new_net_sales_gbp / original_full_price) * 100), 0, 90)
    df.loc[idx, "discount_pct"] = implied_discount.astype(int)

    margin_lo, margin_hi = _margin_bounds(df.loc[idx, "discount_pct"].to_numpy())
    margin_rng = np.random.default_rng(RANDOM_SEED + 12)
    target_margin = margin_rng.uniform(margin_lo, margin_hi)
    df.loc[idx, "cost_gbp"] = np.round(new_net_sales_gbp * (1 - target_margin), 2)

    df.loc[idx, "vat_gbp"] = np.round(new_net_sales_gbp * vat_rate_implied.to_numpy(), 2)
    df.loc[idx, "gross_sales_gbp"] = df.loc[idx, "net_sales_gbp"] + df.loc[idx, "vat_gbp"]
    df.loc[idx, "net_sales_local"] = np.round(new_net_sales_gbp * fx_rate_implied.to_numpy(), 2)

    return df.drop(columns=["product_group", "month", "multibuy_scheme_id"])


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

    cutoff = present_date()
    dim_date = dim_date[dim_date["full_date"] <= cutoff]
    print(f"actuals cutoff: {cutoff} ({len(dim_date):,} of the full calendar's days included)")

    assortment = build_assortment(dim_store, dim_product, markets)
    print(f"assortment: {len(assortment):,} (store, sku) pairs")

    promo_lookup = build_promo_lookup(dim_promo)
    fx_lookup = build_fx_lookup(fx_rate)

    df = simulate(assortment, dim_date, promo_lookup, fx_lookup)
    print(f"simulated: {len(df):,} positive-quantity rows, {df['invoice_id'].nunique():,} invoices")

    # Channel split, before returns/messiness — the number that actually
    # matters for CHANNEL_DEMAND_MULT calibration (see that constant's
    # comment). Printed every run, not just while tuning, since it's the
    # cheapest possible early warning if a future change to the demand
    # model quietly drifts the split away from where it was calibrated.
    channel_by_store = dim_store.set_index("store_id")["channel"]
    channel_sales = df["store_id"].map(channel_by_store).value_counts(normalize=True)
    print("channel split (share of sold lines): " + ", ".join(f"{c}={p:.1%}" for c, p in channel_sales.items()))

    # Brand split (share of NET SALES £, not line count — what actually
    # matters for "is Areta the biggest brand" is revenue, and revenue
    # share can differ meaningfully from line-count share once price
    # differences between brands are in play). See BRAND_DEMAND_MULT's
    # comment for why this needed calibrating in the first place.
    brand_by_sku = dim_product.set_index("sku")["brand_name"]
    brand_sales_gbp = df.assign(brand_name=df["sku"].map(brand_by_sku)).groupby("brand_name")["net_sales_gbp"].sum()
    brand_share = brand_sales_gbp / brand_sales_gbp.sum()
    print(
        "brand split (share of net sales £): "
        + ", ".join(f"{b}={p:.1%}" for b, p in brand_share.sort_values(ascending=False).items())
    )

    df = synthesize_multibuy_attachments(df, dim_product, assortment, fx_lookup)
    df = apply_multibuy_promos(df, dim_product)
    n_multibuy = (df["promo_id"].str.startswith("MULTIBUY-")).sum()
    print(f"multi-buy adjusted: {n_multibuy:,} lines")

    df = add_returns(df, dim_date["full_date"].max(), fx_lookup)
    df = inject_messiness(df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"fact_sales_raw: {len(df):,} rows -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()