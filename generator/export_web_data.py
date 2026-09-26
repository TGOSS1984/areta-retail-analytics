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

fact_sales_style_colour_daily is the same idea one level deeper, for the
top products chart: (date, style_code, colour_code) instead of
(date, store, division). Kept at colour grain deliberately, NOT
collapsed to style — Tom wants product images sourced per colourway (a
jacket in three colours needs three photos, not one shared image), so
the grain the sales data ships at has to match the grain images are
keyed at, or the two can't be joined meaningfully. Size still doesn't
matter for "what sells" and stays collapsed — 12k+ SKUs down to 2,251
style/colour combos. Date grain is kept, same reasoning as
fact_sales_daily, so the web app can apply the same YTD/business-year
filtering client-side rather than this script baking in a period that'll
go stale.

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

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WAREHOUSE = PROJECT_ROOT / "data" / "warehouse"
EXPORTS = PROJECT_ROOT / "data" / "exports"


def export_dim_date() -> None:
    df = pd.read_parquet(WAREHOUSE / "dim_date.parquet")
    cols = [
        "full_date", "day_name", "month_num", "month_name", "calendar_year",
        "business_year", "business_period_number", "business_period_label", "season",
        "business_week_number", "day_of_week_num",
    ]
    df[cols].to_parquet(EXPORTS / "dim_date.parquet", index=False)
    print(f"dim_date: {len(df):,} rows")


def export_dim_store() -> None:
    df = pd.read_parquet(WAREHOUSE / "dim_store.parquet")
    cols = [
        "store_id", "store_name", "channel", "store_type", "square_footage", "market_code",
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


def export_dim_style_colour() -> None:
    df = pd.read_parquet(WAREHOUSE / "dim_product.parquet")
    # Collapse size out at source rather than in the web app — style AND
    # colour are kept (see module docstring: images are sourced per
    # colourway, so sales data has to be joinable at that same grain).
    # base_price_gbp is set per style not per colour/size (see
    # build_dim_product.py), so "first" is safe here, not an average
    # papering over real variation.
    styles = (
        df.groupby(["style_code", "colour_code"], as_index=False)
        .agg(
            style_name=("style_name", "first"),
            colour=("colour", "first"),
            brand_name=("brand_name", "first"),
            division=("division", "first"),
            major_product_group=("major_product_group", "first"),
            product_group=("product_group", "first"),
            gender=("gender", "first"),
            base_price_gbp=("base_price_gbp", "first"),
        )
    )
    # Matches the SKU prefix exactly (sku = f"{style_code}-{colour_code}-
    # {size}", see build_dim_product.py) rather than inventing a separate
    # convention — Tom sources one image per colourway and drops it in
    # named to this, e.g. ARETA00214-BLK.webp.
    styles["image_path"] = styles["style_code"] + "-" + styles["colour_code"]
    styles.to_parquet(EXPORTS / "dim_style_colour.parquet", index=False)
    print(f"dim_style_colour: {len(styles):,} rows")


def export_fact_sales_style_colour_daily() -> None:
    sales = pd.read_parquet(WAREHOUSE / "fact_sales.parquet")
    dim_product = pd.read_parquet(WAREHOUSE / "dim_product.parquet")[
        ["sku", "style_code", "colour_code"]
    ]
    sales = sales.merge(dim_product, on="sku", how="left")

    agg = (
        sales.groupby(["date", "style_code", "colour_code"], as_index=False)
        .agg(
            net_sales_gbp=("net_sales_gbp", "sum"),
            quantity=("quantity", "sum"),
        )
    )
    agg.to_parquet(EXPORTS / "fact_sales_style_colour_daily.parquet", index=False)
    print(f"fact_sales_style_colour_daily: {len(agg):,} rows (from {len(sales):,} invoice lines)")


def export_fact_footfall_daily() -> None:
    """Store-day footfall for the Stores page, plus one thing footfall
    doesn't carry: how many of the day's baskets had two or more items.
    That's the third step of the store funnel (visitors -> buyers ->
    multi-item buyers), so it's counted here from the invoice lines once
    rather than shipping invoice grain to the browser. Returns are left
    out because a refund isn't a basket. The transaction counts already
    reconcile to distinct invoices in total, so the three funnel steps
    come from the same underlying numbers."""
    footfall = pd.read_parquet(WAREHOUSE / "fact_footfall.parquet")[
        ["date", "store_id", "footfall", "transactions", "units_sold"]
    ]
    sales = pd.read_parquet(
        WAREHOUSE / "fact_sales.parquet", columns=["date", "store_id", "invoice_id", "quantity", "is_return"]
    )
    baskets = (
        sales[~sales["is_return"]]
        .groupby(["store_id", "date", "invoice_id"])["quantity"].sum()
    )
    multi = (
        (baskets >= 2).groupby(level=["store_id", "date"]).sum()
        .rename("multi_item_baskets").reset_index()
    )
    out = footfall.merge(multi, on=["store_id", "date"], how="left")
    out["multi_item_baskets"] = out["multi_item_baskets"].fillna(0).astype("int64")
    out.to_parquet(EXPORTS / "fact_footfall_daily.parquet", index=False)
    print(f"fact_footfall_daily: {len(out):,} rows")


def export_fact_targets() -> None:
    """Store x business period targets. Only the two the web app uses so
    far; the rest stay in the warehouse until a page needs them."""
    df = pd.read_parquet(WAREHOUSE / "fact_targets.parquet")[
        ["store_id", "business_year", "business_period_number", "target_net_sales_gbp", "target_footfall"]
    ]
    df.to_parquet(EXPORTS / "fact_targets.parquet", index=False)
    print(f"fact_targets: {len(df):,} rows")


def export_fact_store_finance() -> None:
    """Store x business period P&L lines, for contribution on the Stores
    league table now and the Margins page next."""
    df = pd.read_parquet(WAREHOUSE / "fact_store_finance.parquet")[
        [
            "store_id", "business_year", "business_period_number", "net_sales_gbp", "cogs_gbp",
            "gross_profit_gbp", "rent_gbp", "staff_gbp", "utilities_gbp", "marketing_gbp",
            "head_office_gbp", "net_contribution_gbp",
        ]
    ]
    df.to_parquet(EXPORTS / "fact_store_finance.parquet", index=False)
    print(f"fact_store_finance: {len(df):,} rows")


# Same bands, same order, as the Discount Band column in the Power BI
# model (fact_sales.tmdl), so both front ends mean the same thing by them.
DISCOUNT_BANDS = ["Full Price", "Multi-buy", "Up to 30% off", "31-50% off", "51-70% off", "70%+ off"]


def discount_band(promo_id: pd.Series, discount_pct: pd.Series) -> pd.Series:
    bands = np.select(
        [
            promo_id == "PROMO0000",
            promo_id.str.startswith("MULTIBUY-"),
            discount_pct <= 30,
            discount_pct <= 50,
            discount_pct <= 70,
        ],
        DISCOUNT_BANDS[:5],
        default=DISCOUNT_BANDS[5],
    )
    return pd.Series(bands, index=promo_id.index)


def export_fact_sales_mix_daily() -> None:
    """Sales by day, market, channel, product hierarchy and discount band, for
    the Categories and Margins pages. It's the one grain that answers
    "which categories, where, through which channel, at what discount"
    without shipping line-level data: about 0.9M rows against 3.9M lines.
    Market is carried directly rather than store, because nothing on those
    pages needs a single store and it keeps the file a fraction of the
    size. Cost is included so margin can be worked out at any cut.

    Division and major group ride along because three product groups
    (Softshell, Gilets & Bodywarmers, Socks) sit under two major groups
    each, so the hierarchy can't be rebuilt from product group alone."""
    sales = pd.read_parquet(
        WAREHOUSE / "fact_sales.parquet",
        columns=["date", "store_id", "sku", "promo_id", "discount_pct", "net_sales_gbp", "cost_gbp", "quantity"],
    )
    product = pd.read_parquet(
        WAREHOUSE / "dim_product.parquet", columns=["sku", "division", "major_product_group", "product_group"]
    )
    store = pd.read_parquet(WAREHOUSE / "dim_store.parquet", columns=["store_id", "market_code", "channel"])
    sales = sales.merge(product, on="sku").merge(store, on="store_id")
    sales["discount_band"] = discount_band(sales["promo_id"], sales["discount_pct"])
    out = (
        sales.groupby(
            ["date", "market_code", "channel", "division", "major_product_group", "product_group", "discount_band"],
            as_index=False,
        )
        .agg(net_sales_gbp=("net_sales_gbp", "sum"), cost_gbp=("cost_gbp", "sum"), quantity=("quantity", "sum"))
    )
    out["net_sales_gbp"] = out["net_sales_gbp"].round(2)
    out["cost_gbp"] = out["cost_gbp"].round(2)
    out.to_parquet(EXPORTS / "fact_sales_mix_daily.parquet", index=False)
    print(f"fact_sales_mix_daily: {len(out):,} rows")


def main() -> None:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    export_dim_date()
    export_dim_store()
    export_fact_sales_daily()
    export_dim_style_colour()
    export_fact_sales_style_colour_daily()
    export_fact_footfall_daily()
    export_fact_targets()
    export_fact_store_finance()
    export_fact_sales_mix_daily()


if __name__ == "__main__":
    main()