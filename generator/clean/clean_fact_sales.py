"""
clean_fact_sales.py

Second half of the fact_sales pipeline — takes the deliberately messy
output of generator/facts/build_fact_sales.py and turns it into the
deduplicated, typed table that actually lands in data/staging and
data/warehouse. This is the one script in the whole generator that's
allowed to assume its input isn't perfectly clean.

What it fixes, and why each one's actually in the raw file:
  - store_id sometimes lowercase                    -> normalise to upper
  - currency has stray leading/trailing whitespace   -> strip it
  - a small number of exact duplicate rows           -> drop
  - discount_pct null on full-price rows             -> should be 0, not missing

Also runs a foreign-key check against the dimension tables before writing
anything out. Mainly there to catch the class of bug where dim_product got
regenerated (reshuffling the SKU sample) after fact_sales was already
built against an older version — same underlying issue as the missing-file
error from running these out of order, just a quieter version of it.

Writes the same cleaned table to both data/staging (the audit trail —
"here's what cleaning actually did") and data/warehouse (what Power BI
imports from).

Usage:
    python clean_fact_sales.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1].parent
RAW_PATH = PROJECT_ROOT / "data" / "raw" / "fact_sales_raw.csv"
STAGING_PATH = PROJECT_ROOT / "data" / "staging" / "fact_sales.parquet"
WAREHOUSE_PATH = PROJECT_ROOT / "data" / "warehouse" / "fact_sales.parquet"

DIM_STORE_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_store.parquet"
DIM_PRODUCT_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_product.parquet"
DIM_PROMO_PATH = PROJECT_ROOT / "data" / "warehouse" / "dim_promo.parquet"


def clean(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)

    df["store_id"] = df["store_id"].str.upper()
    df["currency"] = df["currency"].str.strip()
    df["discount_pct"] = df["discount_pct"].fillna(0).astype(int)

    df = df.drop_duplicates()
    dupes_dropped = before - len(df)

    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["quantity"] = df["quantity"].astype(int)
    df["is_return"] = df["is_return"].astype(bool)

    print(f"cleaned: {before:,} -> {len(df):,} rows ({dupes_dropped:,} exact duplicates dropped)")
    return df


def validate_foreign_keys(df: pd.DataFrame) -> None:
    valid_stores = set(pd.read_parquet(DIM_STORE_PATH)["store_id"])
    valid_skus = set(pd.read_parquet(DIM_PRODUCT_PATH)["sku"])
    valid_promos = set(pd.read_parquet(DIM_PROMO_PATH)["promo_id"])

    orphan_stores = int((~df["store_id"].isin(valid_stores)).sum())
    orphan_skus = int((~df["sku"].isin(valid_skus)).sum())
    orphan_promos = int((~df["promo_id"].isin(valid_promos)).sum())

    if orphan_stores or orphan_skus or orphan_promos:
        raise ValueError(
            f"foreign key check failed: {orphan_stores} rows with an unknown store_id, "
            f"{orphan_skus} with an unknown sku, {orphan_promos} with an unknown promo_id. "
            "Likely cause: a dimension was regenerated after fact_sales was built — "
            "rerun the dimension builders, then facts/build_fact_sales.py, then this script."
        )
    print("foreign key check passed: every store_id, sku, and promo_id resolves to a dimension row")


def main() -> None:
    df = pd.read_csv(RAW_PATH)
    df = clean(df)
    validate_foreign_keys(df)

    STAGING_PATH.parent.mkdir(parents=True, exist_ok=True)
    WAREHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(STAGING_PATH, index=False)
    df.to_parquet(WAREHOUSE_PATH, index=False)

    print(f"fact_sales: {len(df):,} rows -> {STAGING_PATH}")
    print(f"fact_sales: {len(df):,} rows -> {WAREHOUSE_PATH}")


if __name__ == "__main__":
    main()