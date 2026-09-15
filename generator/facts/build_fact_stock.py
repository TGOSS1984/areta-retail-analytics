"""
build_fact_stock.py

Weekly stock snapshot — one row per (week ending, store, style, colour),
not full SKU. Dropped size from this grain on purpose: at ~11,500 SKUs x
351 stores x 208 weeks, a size-level weekly stock table is genuinely too
big for what it'd be used for — this gets analysed one level up anyway,
overstocked/understocked by store and product group, not by individual
size run. style_code + colour is carried directly on this fact table
rather than through a separate dimension, a small denormalisation but a
standard one for exactly this situation.

First version of this script OOM'd. Reconstructing the full SKU-level
assortment per store and rolling it up to style+colour produced ~83,600
pairs — a random 350-SKU sample spreads across most of the catalog's ~2,165
distinct style/colour combinations rather than clustering in a few, which
I hadn't accounted for. Cross-joined against 208 weeks with string columns
repeated in full at every row, that's what actually killed the process —
not the row count on its own so much as building it as 208 separate
pandas DataFrames with object-dtype strings duplicated in each one.

Two changes to fix it:
  - each store's style/colour set (still drawn from what its SKU
    assortment could have sold — keeps stock consistent with fact_sales)
    gets capped and sub-sampled down to a couple hundred at most, which is
    also just more realistic — no store stocks 500+ distinct style/colour
    lines at once
  - the week-by-week simulation runs on plain numpy arrays throughout, and
    the repeated text columns (store_id, style_code, etc.) get built as
    pandas Categoricals from tiled integer codes rather than tiled strings,
    so the repetition costs bytes per code, not bytes per string

Simple (s, S) inventory policy per (store, style, colour): sell down each
week against actual units sold that week (from fact_sales, rolled up from
SKU to style+colour), and when stock falls below a reorder point (35% of
a target stock level), replenish straight back up to target. No delivery
lead time modelled — replenishment is instant when triggered.

Depends on fact_sales existing in data/warehouse.

Usage:
    python build_fact_stock.py
"""

from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_PRODUCT_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_product.parquet"
DIM_DATE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_date.parquet"
FACT_SALES_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"
OUTPUT_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_stock_snapshot.parquet"

RANDOM_SEED = 99  # matches build_fact_sales.py's RANDOM_SEED — has to, to reconstruct the same SKU assortment

# same cutoff concept as build_fact_sales.py — a stock snapshot can't
# exist for a week that hasn't happened yet
PRESENT_DATE_OVERRIDE: dt.date | None = None


def present_date() -> dt.date:
    return PRESENT_DATE_OVERRIDE or dt.date.today()
ASSORTMENT_SIZE = {"Retail": 350, "Concession": 120}  # same as build_fact_sales.py

# separate, smaller cap on distinct style/colour lines actually held in
# stock — see module docstring for why this is needed
STOCK_ASSORTMENT_CAP = {"Retail": 130, "Concession": 45}

TARGET_WEEKS_COVER_RANGE = (6, 18)
REORDER_FRACTION = 0.35
MIN_STOCK_FLOOR = 10  # minimum display/pack quantity — real stores hold at least this many of a line for shelf presentation regardless of how slowly it actually sells


def _store_seed(store_id: str) -> int:
    return int(hashlib.sha256(store_id.encode()).hexdigest(), 16) % (2**32)


def build_assortment(dim_store: pd.DataFrame, dim_product: pd.DataFrame) -> pd.DataFrame:
    parts = []
    for store in dim_store.itertuples():
        rng = np.random.default_rng(_store_seed(store.store_id))
        n = min(ASSORTMENT_SIZE[store.channel], len(dim_product))
        picked = dim_product.iloc[rng.choice(len(dim_product), size=n, replace=False)].copy()

        style_colour = picked.drop_duplicates(["style_code", "colour"])[
            ["style_code", "colour", "brand_code", "division",
             "major_product_group", "product_group", "base_price_gbp", "cost_price_gbp"]
        ]

        cap = min(STOCK_ASSORTMENT_CAP[store.channel], len(style_colour))
        cap_rng = np.random.default_rng(_store_seed(store.store_id + "-stockcap"))
        style_colour = style_colour.iloc[cap_rng.choice(len(style_colour), size=cap, replace=False)].copy()
        style_colour["store_id"] = store.store_id

        parts.append(style_colour)

    return pd.concat(parts, ignore_index=True)


def weekly_sales(dim_product: pd.DataFrame, dim_date: pd.DataFrame) -> pd.DataFrame:
    sales = pd.read_parquet(FACT_SALES_PATH)
    sales = sales[~sales["is_return"]]
    sales = sales.merge(dim_product[["sku", "style_code", "colour"]], on="sku", how="left")
    sales = sales.merge(
        dim_date[["full_date", "business_year", "business_week_number"]],
        left_on="date", right_on="full_date", how="left",
    )
    sales["week_key"] = sales["business_year"] * 100 + sales["business_week_number"]

    return (
        sales.groupby(["store_id", "style_code", "colour", "week_key"])["quantity"]
        .sum()
        .rename("units_sold")
        .reset_index()
    )


def week_ending_dates(dim_date: pd.DataFrame) -> pd.DataFrame:
    weeks = (
        dim_date.groupby(["business_year", "business_week_number"])["full_date"]
        .max()
        .rename("week_ending_date")
        .reset_index()
        .sort_values(["business_year", "business_week_number"])
        .reset_index(drop=True)
    )
    weeks["week_key"] = weeks["business_year"] * 100 + weeks["business_week_number"]
    weeks["week_idx"] = np.arange(len(weeks))
    return weeks


def build() -> pd.DataFrame:
    dim_store = pd.read_parquet(DIM_STORE_PATH)
    dim_product = pd.read_parquet(DIM_PRODUCT_PATH)
    dim_date = pd.read_parquet(DIM_DATE_PATH)

    assortment = build_assortment(dim_store, dim_product).reset_index(drop=True)
    n_pairs = len(assortment)
    print(f"assortment (store, style, colour): {n_pairs:,} pairs")

    weekly = weekly_sales(dim_product, dim_date)

    # weeks computed from the FULL calendar first, THEN cut off by
    # week_ending_date — not by filtering dim_date's rows before
    # grouping, which would give an in-progress week a fake early
    # "ending" date instead of correctly excluding it until it's
    # actually finished
    weeks = week_ending_dates(dim_date)
    cutoff = present_date()
    weeks = weeks[weeks["week_ending_date"] <= cutoff].reset_index(drop=True)
    weeks["week_idx"] = np.arange(len(weeks))
    n_weeks = len(weeks)
    print(f"weeks: {n_weeks} (cutoff: {cutoff})")

    # pair_idx lookup via merge (vectorised), not a python dict built by looping
    pair_lookup = assortment[["store_id", "style_code", "colour"]].copy()
    pair_lookup["pair_idx"] = np.arange(n_pairs)

    weekly_indexed = weekly.merge(pair_lookup, on=["store_id", "style_code", "colour"], how="inner")
    weekly_indexed = weekly_indexed.merge(weeks[["week_key", "week_idx"]], on="week_key", how="inner")

    # sold_matrix built directly via numpy fancy-indexed assignment — no
    # dense cross-join dataframe ever gets materialised
    sold_matrix = np.zeros((n_weeks, n_pairs))
    sold_matrix[weekly_indexed["week_idx"].to_numpy(), weekly_indexed["pair_idx"].to_numpy()] = (
        weekly_indexed["units_sold"].to_numpy()
    )

    rng = np.random.default_rng(RANDOM_SEED + 5)
    total_sold = sold_matrix.sum(axis=0)
    avg_weekly_velocity = total_sold / n_weeks

    target_weeks_cover = rng.uniform(*TARGET_WEEKS_COVER_RANGE, size=n_pairs)
    target_stock_level = np.maximum(avg_weekly_velocity * target_weeks_cover, MIN_STOCK_FLOOR)
    reorder_point = target_stock_level * REORDER_FRACTION

    cost_arr = assortment["cost_price_gbp"].to_numpy()
    price_arr = assortment["base_price_gbp"].to_numpy()

    stock_matrix = np.empty((n_weeks, n_pairs))
    stock = target_stock_level.copy()
    for w in range(n_weeks):
        stock = np.maximum(stock - sold_matrix[w], 0)
        stock = np.where(stock < reorder_point, target_stock_level, stock)
        stock_matrix[w] = stock

    stock_matrix = np.round(stock_matrix).astype(np.int32)

    week_ending_lookup = weeks.sort_values("week_idx")["week_ending_date"].to_numpy()

    def tiled_categorical(col: str) -> pd.Categorical:
        cat = pd.Categorical(assortment[col])
        return pd.Categorical.from_codes(np.tile(cat.codes, n_weeks), categories=cat.categories)

    out = pd.DataFrame(
        {
            "week_ending_date": np.repeat(week_ending_lookup, n_pairs),
            "store_id": tiled_categorical("store_id"),
            "style_code": tiled_categorical("style_code"),
            "colour": tiled_categorical("colour"),
            "brand_code": tiled_categorical("brand_code"),
            "division": tiled_categorical("division"),
            "major_product_group": tiled_categorical("major_product_group"),
            "product_group": tiled_categorical("product_group"),
            "stock_units": stock_matrix.reshape(-1),
            "stock_value_cost_gbp": np.round(stock_matrix.reshape(-1) * np.tile(cost_arr, n_weeks), 2),
            "stock_value_retail_gbp": np.round(stock_matrix.reshape(-1) * np.tile(price_arr, n_weeks), 2),
        }
    )
    return out


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"fact_stock_snapshot: {len(df):,} rows -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()