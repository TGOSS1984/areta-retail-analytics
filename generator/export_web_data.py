"""
export_web_data.py

Builds the pre-aggregated Parquet exports the web app reads via
DuckDB-wasm — data/exports/, not data/warehouse/. The distinction
matters: warehouse tables are what Power BI imports (full grain,
invoice-line detail included); these exports are deliberately coarser,
sized for a browser to load over HTTP and query client-side, not for a
desktop app with local disk and RAM to spare.

fact_sales_daily aggregates away invoice/line grain entirely — the web
app's overview-level visuals (trend, category mix, channel mix) don't
need individual transaction detail, only date/store/category
granularity. That's the single biggest lever on file size: invoice-grain
fact_sales is 3M+ rows; this collapses to (date, store, division).

Still a real star schema, not one flat denormalised table — dim_date and
dim_store ship separately alongside the fact, and the web app joins them
client-side via DuckDB-wasm SQL, the same way Power BI would. That's
deliberate: it's more honest about what a star schema actually is, and
it means adding more filterable attributes later (market, channel,
region are already in dim_store) doesn't require re-exporting the fact
table, just widening what the dimension export already carries.

Usage:
    python export_web_data.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WAREHOUSE = PROJECT_ROOT / "data" / "warehouse"
EXPORTS = PROJECT_ROOT / "data" / "exports"


def export_dim_date() -> None:
    df = pd.read_parquet(WAREHOUSE / "dim_date.parquet")
    cols = [
        "full_date", "day_name", "month_num", "month_name", "calendar_year",
        "business_year", "business_period_number", "business_period_label", "season",
    ]
    df[cols].to_parquet(EXPORTS / "dim_date.parquet", index=False)
    print(f"dim_date: {len(df):,} rows")


def export_dim_store() -> None:
    df = pd.read_parquet(WAREHOUSE / "dim_store.parquet")
    cols = [
        "store_id", "store_name", "channel", "store_type", "market_code",
        "market_name", "city", "region", "latitude", "longitude", "currency", "is_home_market",
    ]
    df[cols].to_parquet(EXPORTS / "dim_store.parquet", index=False)
    print(f"dim_store: {len(df):,} rows")


def export_fact_sales_daily() -> None:
    sales = pd.read_parquet(WAREHOUSE / "fact_sales.parquet")
    dim_product = pd.read_parquet(WAREHOUSE / "dim_product.parquet")[
        ["sku", "division", "major_product_group", "product_group"]
    ]
    sales = sales.merge(dim_product, on="sku", how="left")

    agg = (
        sales.groupby(["date", "store_id", "division"], as_index=False)
        .agg(
            net_sales_gbp=("net_sales_gbp", "sum"),
            cost_gbp=("cost_gbp", "sum"),
            vat_gbp=("vat_gbp", "sum"),
            quantity=("quantity", "sum"),
        )
    )
    agg.to_parquet(EXPORTS / "fact_sales_daily.parquet", index=False)
    print(f"fact_sales_daily: {len(agg):,} rows (from {len(sales):,} invoice lines)")


def main() -> None:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    export_dim_date()
    export_dim_store()
    export_fact_sales_daily()


if __name__ == "__main__":
    main()