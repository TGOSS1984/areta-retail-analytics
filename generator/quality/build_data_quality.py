"""
build_data_quality.py

Audits the finished warehouse and writes two small tables the Power BI
"Data Quality" page reads from:

  dq_check_results  one row per check: what was tested, how many rows were
                    tested, how many failed, and a Pass / Warn / Fail / Fixed
                    status
  dq_table_profile  one row per warehouse table: row and column counts, null
                    cells, and how fresh the data is

Why this lives in the generator and not in DAX: orphan keys and duplicates
are easy to find in the parquet files but awkward to find in the model,
because Power BI relationships quietly hide orphans. Doing it here also means
the weekly GitHub Action refreshes the audit along with the data, so the page
never goes stale relative to the tables it's describing.

Seven kinds of check:
  Integrity       every foreign key resolves to a dimension row
  Uniqueness      each table's key really is unique
  Validity        row-level rules (no negative prices, P&L arithmetic ties, etc.)
  Completeness    the rows that should exist do exist
  Reconciliation  two tables that should agree on a number, do
  Freshness       the actuals run right up to the run date
  Cleaning        what clean_fact_sales.py fixed in the raw file (counts only,
                  these don't count towards the score)

Severity decides what a failure means. "Critical" checks show as Fail if any
row breaks them. "Advisory" checks show as Warn - things worth knowing about
that aren't necessarily wrong (a SKU nobody bought, a quiet trading day).

The reconciliations compare like with like. Digital sales, footfall
transactions and footfall units all tie to sales BEFORE returns, because
returns only exist as lines in fact_sales. Comparing them against net-of-
returns would make three healthy tables look broken.

This runs last in weekly_refresh.py so the web exports exist by the time it
compares them to the warehouse. It never fails the pipeline because a check
failed - a failing check is data, and it shows up on the page. It only exits
non-zero if it can't run at all, or with --strict if a Critical check fails.

Usage:
    python build_data_quality.py
    python build_data_quality.py --strict
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

PROJECT_ROOT = Path(__file__).resolve().parents[2]
WAREHOUSE = PROJECT_ROOT / "data" / "warehouse"
EXPORTS = PROJECT_ROOT / "data" / "exports"
RAW_SALES_PATH = PROJECT_ROOT / "data" / "raw" / "fact_sales_raw.csv"

CHECKS_OUT = WAREHOUSE / "dq_check_results.parquet"
PROFILE_OUT = WAREHOUSE / "dq_table_profile.parquet"

MONEY_TOLERANCE_GBP = 1.00  # per store-period / market-day tie-out
ROUNDING_TOLERANCE_GBP = 0.05  # for row-level arithmetic that should be exact to the penny
PERIODS_PER_YEAR = 12

# how far behind the run date the latest actuals may be before I call it stale
FRESHNESS_RULES = {
    "fact_sales": ("date", 1),
    "fact_footfall": ("date", 1),
    "fact_digital_sales": ("date", 1),
    "fact_digital_traffic": ("date", 1),
    "fact_stock_snapshot": ("week_ending_date", 7),  # weekly snapshot
}

GRAIN = {
    "dim_date": "One row per calendar day",
    "dim_period": "One row per business period",
    "dim_store": "One row per store or online site",
    "dim_product": "One row per SKU (style, colour, size)",
    "dim_promo": "One row per promotion",
    "dim_currency": "One row per currency",
    "fx_rate_monthly": "One row per currency per month",
    "fact_sales": "One row per invoice line",
    "fact_footfall": "One row per store per day",
    "fact_stock_snapshot": "One row per store, style and colour per week",
    "fact_store_finance": "One row per store per business period",
    "fact_targets": "One row per store per business period",
    "fact_digital_sales": "One row per market, device and day",
    "fact_digital_traffic": "One row per market, device, browser and day",
    "fact_digital_targets": "One row per market per business period",
}

CATEGORY_ORDER = {
    "Integrity": 1,
    "Uniqueness": 2,
    "Validity": 3,
    "Completeness": 4,
    "Reconciliation": 5,
    "Freshness": 6,
    "Cleaning": 7,
}

# so the page can sort statuses worst-first instead of alphabetically
STATUS_ORDER = {"Fail": 1, "Warn": 2, "Pass": 3, "Fixed": 4}

SALES_COLS = [
    "date", "store_id", "invoice_id", "sku", "quantity", "promo_id", "discount_pct",
    "unit_price_gbp", "net_sales_gbp", "vat_gbp", "gross_sales_gbp", "currency",
    "cost_gbp", "is_return", "line_number",
]
STOCK_COLS = [
    "week_ending_date", "store_id", "style_code", "colour", "stock_units",
    "stock_value_cost_gbp", "stock_value_retail_gbp",
]

# (child table, child column, parent table, parent column)
FOREIGN_KEYS = [
    ("fact_sales", "store_id", "dim_store", "store_id"),
    ("fact_sales", "sku", "dim_product", "sku"),
    ("fact_sales", "promo_id", "dim_promo", "promo_id"),
    ("fact_sales", "currency", "dim_currency", "currency_code"),
    ("fact_sales", "date", "dim_date", "full_date"),
    ("fact_footfall", "store_id", "dim_store", "store_id"),
    ("fact_stock_snapshot", "store_id", "dim_store", "store_id"),
    ("fact_targets", "store_id", "dim_store", "store_id"),
    ("fact_targets", "period_key", "dim_period", "period_key"),
    ("fact_store_finance", "store_id", "dim_store", "store_id"),
    ("fact_store_finance", "period_key", "dim_period", "period_key"),
    ("fact_digital_sales", "market_code", "dim_store", "market_code"),
    ("fact_digital_traffic", "market_code", "dim_store", "market_code"),
    ("fact_digital_targets", "market_code", "dim_store", "market_code"),
    ("fact_digital_targets", "period_key", "dim_period", "period_key"),
]

# (table, the columns that together should be unique)
UNIQUE_KEYS = [
    ("fact_sales", ["invoice_id", "line_number"]),
    ("fact_footfall", ["date", "store_id"]),
    ("fact_stock_snapshot", ["week_ending_date", "store_id", "style_code", "colour"]),
    ("fact_targets", ["store_id", "period_key"]),
    ("fact_store_finance", ["store_id", "period_key"]),
    ("fact_digital_sales", ["date", "market_code", "device_type"]),
    ("fact_digital_traffic", ["date", "market_code", "device_type", "browser"]),
    ("fact_digital_targets", ["market_code", "period_key"]),
    ("dim_store", ["store_id"]),
    ("dim_product", ["sku"]),
    ("dim_date", ["full_date"]),
    ("dim_period", ["period_key"]),
]


def load(name: str, columns: list[str] | None = None) -> pd.DataFrame:
    return pd.read_parquet(WAREHOUSE / f"{name}.parquet", columns=columns)


def as_datetime(series: pd.Series) -> pd.Series:
    # parquet dates come back as python date objects in some pandas versions
    # and datetime64 in others; normalise so joins and isin() behave the same
    return pd.to_datetime(series)


class Audit:
    def __init__(self, run_timestamp: str) -> None:
        # kept as text on purpose: Power BI's parquet reader choked on the
        # nanosecond timestamp pandas writes by default ("Couldn't deserialize
        # thrift"), and plain text sidesteps any timestamp-encoding differences
        # between pandas / pyarrow versions. It's UTC, "YYYY-MM-DD HH:MM:SS".
        self.run_timestamp = run_timestamp
        self.rows: list[dict] = []

    def add(
        self,
        check_id: str,
        category: str,
        table: str,
        name: str,
        description: str,
        tested: int,
        failed: int,
        severity: str = "Critical",
        source_a: tuple[str, float] | None = None,
        source_b: tuple[str, float] | None = None,
        scored: bool = True,
    ) -> None:
        tested, failed = int(tested), int(failed)
        if failed == 0:
            status = "Pass"
        elif category == "Cleaning":
            status = "Fixed"
        else:
            status = "Fail" if severity == "Critical" else "Warn"

        self.rows.append(
            {
                "check_id": check_id,
                "category": category,
                "category_order": CATEGORY_ORDER[category],
                "table_name": table,
                "check_name": name,
                "check_description": description,
                "severity": severity,
                "rows_tested": tested,
                "rows_failed": failed,
                "status": status,
                "status_order": STATUS_ORDER[status],
                "counts_toward_score": 1 if scored else 0,
                "source_a_label": source_a[0] if source_a else None,
                "source_a_value": float(source_a[1]) if source_a else np.nan,
                "source_b_label": source_b[0] if source_b else None,
                "source_b_value": float(source_b[1]) if source_b else np.nan,
                "run_timestamp": self.run_timestamp,
            }
        )

    def frame(self) -> pd.DataFrame:
        df = pd.DataFrame(self.rows)
        df["variance"] = df["source_a_value"] - df["source_b_value"]
        return df.sort_values(["category_order", "check_id"]).reset_index(drop=True)


# --------------------------------------------------------------------------
# integrity + uniqueness
# --------------------------------------------------------------------------
def check_integrity(audit: Audit, tables: dict[str, pd.DataFrame]) -> None:
    for i, (child, child_col, parent, parent_col) in enumerate(FOREIGN_KEYS, start=1):
        child_vals = tables[child][child_col]
        parent_vals = tables[parent][parent_col]
        if child_col == "date":
            child_vals, parent_vals = as_datetime(child_vals), as_datetime(parent_vals)
        orphans = ~child_vals.isin(parent_vals.unique())
        audit.add(
            f"INT-{i:02d}", "Integrity", child,
            f"{child}.{child_col} \u2192 {parent}",
            f"Every {child}.{child_col} matches a row in {parent}.{parent_col}.",
            len(child_vals), orphans.sum(),
        )


def check_uniqueness(audit: Audit, tables: dict[str, pd.DataFrame]) -> None:
    for i, (table, keys) in enumerate(UNIQUE_KEYS, start=1):
        df = tables[table]
        dupes = df.duplicated(subset=keys).sum()
        audit.add(
            f"UNQ-{i:02d}", "Uniqueness", table,
            f"{table} key is unique",
            f"No two rows in {table} share the same ({', '.join(keys)}).",
            len(df), dupes,
        )


# --------------------------------------------------------------------------
# validity
# --------------------------------------------------------------------------
def check_validity(audit: Audit, t: dict[str, pd.DataFrame]) -> None:
    s = t["fact_sales"]
    ret = s["is_return"]
    n = len(s)

    def v(check_id, table, name, desc, tested, failed, severity="Critical"):
        audit.add(check_id, "Validity", table, name, desc, tested, failed, severity)

    v("VAL-01", "fact_sales", "Sale lines have non-negative net sales",
      "Lines that aren't returns never carry negative net sales.", n, ((~ret) & (s["net_sales_gbp"] < 0)).sum())
    v("VAL-02", "fact_sales", "Return flag agrees with quantity sign",
      "Returns have negative quantity, everything else positive.", n,
      ((ret & (s["quantity"] > 0)) | (~ret & (s["quantity"] <= 0))).sum())
    v("VAL-03", "fact_sales", "Discount within 0-100%",
      "discount_pct is never below 0 or above 100.", n, ((s["discount_pct"] < 0) | (s["discount_pct"] > 100)).sum())
    v("VAL-04", "fact_sales", "Unit price above zero",
      "Every line has a positive unit price.", n, (s["unit_price_gbp"] <= 0).sum())
    key_cols = ["date", "store_id", "sku", "quantity", "net_sales_gbp", "cost_gbp"]
    v("VAL-05", "fact_sales", "No missing values in key columns",
      f"No nulls in {', '.join(key_cols)}.", n, s[key_cols].isna().any(axis=1).sum())
    v("VAL-06", "fact_sales", "Gross sales = net sales + VAT",
      f"gross_sales_gbp equals net_sales_gbp plus vat_gbp to within {ROUNDING_TOLERANCE_GBP * 100:.0f}p.", n,
      ((s["gross_sales_gbp"] - (s["net_sales_gbp"] + s["vat_gbp"])).abs() > ROUNDING_TOLERANCE_GBP).sum())

    promo = t["dim_promo"].set_index("promo_id")
    promo_lines = s[s["promo_id"] != "PROMO0000"]
    line_dates = as_datetime(promo_lines["date"])
    starts = as_datetime(promo_lines["promo_id"].map(promo["start_date"]))
    ends = as_datetime(promo_lines["promo_id"].map(promo["end_date"]))
    # multi-buy promos have no date window, so they can't be tested against one
    dated = starts.notna() & ends.notna()
    v("VAL-07", "fact_sales", "Promo lines fall inside the promo window",
      "Every promotional line whose promotion has a date window is dated between its start and end date.",
      dated.sum(), ((line_dates < starts) | (line_dates > ends))[dated].sum())
    v("VAL-08", "fact_sales", "No sale lines below cost",
      "Sale lines whose cost is higher than their net sales.", n, ((~ret) & (s["cost_gbp"] > s["net_sales_gbp"])).sum(),
      severity="Advisory")

    f = t["fact_footfall"]
    # Stores are shut on Christmas Day, so a zero there is correct, not a
    # broken door counter. Those days are left out of the rows tested.
    christmas = set(as_datetime(t["dim_date"].loc[t["dim_date"]["is_christmas_day"], "full_date"]))
    open_days = f[~as_datetime(f["date"]).isin(christmas)]
    v("VAL-09", "fact_footfall", "Footfall above zero on trading days",
      "Every store-day records at least one visitor, apart from Christmas Day when the stores are shut.",
      len(open_days), (open_days["footfall"] <= 0).sum())
    v("VAL-10", "fact_footfall", "Transactions and conversion are consistent",
      "Transactions never exceed footfall and conversion rate stays between 0 and 1.", len(f),
      ((f["transactions"] > f["footfall"]) | (f["conversion_rate"] < 0) | (f["conversion_rate"] > 1)).sum())

    k = t["fact_stock_snapshot"]
    v("VAL-11", "fact_stock_snapshot", "Stock units are not negative",
      "stock_units is zero or above on every row.", len(k), (k["stock_units"] < 0).sum())
    v("VAL-12", "fact_stock_snapshot", "Retail value at least cost value",
      "Stock is never valued at retail below cost.", len(k), (k["stock_value_retail_gbp"] < k["stock_value_cost_gbp"]).sum())

    fin = t["fact_store_finance"]
    tol = ROUNDING_TOLERANCE_GBP
    v("VAL-13", "fact_store_finance", "Gross profit = net sales - COGS",
      "Gross profit ties to net sales less cost of goods on every store-period.", len(fin),
      ((fin["gross_profit_gbp"] - (fin["net_sales_gbp"] - fin["cogs_gbp"])).abs() > tol).sum())
    v("VAL-14", "fact_store_finance", "Gross contribution ties to its cost lines",
      "Gross contribution = gross profit less rent, staff, utilities and marketing.", len(fin),
      ((fin["gross_contribution_gbp"] - (fin["gross_profit_gbp"] - fin["rent_gbp"] - fin["staff_gbp"]
                                          - fin["utilities_gbp"] - fin["marketing_gbp"])).abs() > tol).sum())
    v("VAL-15", "fact_store_finance", "Net contribution = gross contribution - head office",
      "Net contribution ties to gross contribution less the head office allocation.", len(fin),
      ((fin["net_contribution_gbp"] - (fin["gross_contribution_gbp"] - fin["head_office_gbp"])).abs() > tol).sum())

    tg = t["fact_targets"]
    v("VAL-16", "fact_targets", "Targets are in a sensible range",
      "No negative sales or unit targets, and the margin target is between 0% and 100%.", len(tg),
      ((tg["target_net_sales_gbp"] < 0) | (tg["target_net_units_sold"] < 0)
       | (tg["target_gross_margin_pct"] < 0) | (tg["target_gross_margin_pct"] > 1)).sum())

    d = t["fact_digital_sales"]
    v("VAL-17", "fact_digital_sales", "Units are at least orders",
      "Every market-device-day sells at least one unit per order.", len(d), (d["units"] < d["orders"]).sum())
    with_orders = d[d["orders"] > 0]
    v("VAL-18", "fact_digital_sales", "Basket value = net sales / orders",
      "Wherever there are orders, basket_value_gbp matches net sales divided by orders.", len(with_orders),
      ((with_orders["basket_value_gbp"] - with_orders["net_sales_gbp"] / with_orders["orders"]).abs() > 0.02).sum())

    tr = t["fact_digital_traffic"]
    v("VAL-19", "fact_digital_traffic", "Sessions at least visitors",
      "A visitor implies at least one session, so sessions shouldn't fall below visitors.", len(tr),
      (tr["sessions"] < tr["visitors"]).sum(), severity="Advisory")
    v("VAL-20", "fact_digital_traffic", "Page views at least sessions",
      "Every session views at least one page.", len(tr), (tr["page_views"] < tr["sessions"]).sum())

    p = t["dim_product"]
    v("VAL-21", "dim_product", "Base price above cost price above zero",
      "Every SKU is priced above its cost, and cost is positive.", len(p),
      ((p["base_price_gbp"] <= p["cost_price_gbp"]) | (p["cost_price_gbp"] <= 0)).sum())
    pr = t["dim_promo"]
    v("VAL-22", "dim_promo", "Promo end date not before start date",
      "No promotion ends before it starts.", len(pr), (as_datetime(pr["end_date"]) < as_datetime(pr["start_date"])).sum())
    st = t["dim_store"]
    v("VAL-23", "dim_store", "Store coordinates are valid",
      "Latitude and longitude are present and in range, so the map can place every store.", len(st),
      (st["latitude"].isna() | st["longitude"].isna() | ~st["latitude"].between(-90, 90)
       | ~st["longitude"].between(-180, 180)).sum())


# --------------------------------------------------------------------------
# completeness
# --------------------------------------------------------------------------
def check_completeness(audit: Audit, t: dict[str, pd.DataFrame]) -> None:
    def c(check_id, table, name, desc, expected, missing, severity="Critical"):
        audit.add(check_id, "Completeness", table, name, desc, expected, max(int(missing), 0), severity)

    dim_date, periods, stores = t["dim_date"], t["dim_period"], t["dim_store"]
    sales, footfall = t["fact_sales"], t["fact_footfall"]

    days = as_datetime(dim_date["full_date"])
    expected_days = (days.max() - days.min()).days + 1
    c("CMP-01", "dim_date", "No gaps in the date dimension",
      "Every calendar day between the first and last date has a row.", expected_days, expected_days - days.nunique())

    n_years = periods["business_year"].nunique()
    c("CMP-02", "dim_period", "Every business year has all its periods",
      f"{PERIODS_PER_YEAR} periods in each business year.", n_years * PERIODS_PER_YEAR,
      n_years * PERIODS_PER_YEAR - periods["period_key"].nunique())

    trading = stores.loc[stores["channel"] != "Online", "store_id"]
    ff_dates = as_datetime(footfall["date"])
    ff_days = (ff_dates.max() - ff_dates.min()).days + 1
    expected = len(trading) * ff_days
    c("CMP-03", "fact_footfall", "Footfall for every trading store, every day",
      "Every non-online store has a footfall row for every day in the range.", expected,
      expected - footfall[["date", "store_id"]].drop_duplicates().shape[0])

    ds = t["fact_digital_sales"]
    markets = ds["market_code"].nunique()
    ds_days = (as_datetime(ds["date"]).max() - as_datetime(ds["date"]).min()).days + 1
    expected = markets * ds_days * ds["device_type"].nunique()
    c("CMP-04", "fact_digital_sales", "Digital sales for every market, device and day",
      "Every market has a row for each device on every day in the range.", expected,
      expected - ds[["date", "market_code", "device_type"]].drop_duplicates().shape[0])

    tr = t["fact_digital_traffic"]
    expected = markets * ds_days * tr["device_type"].nunique() * tr["browser"].nunique()
    c("CMP-05", "fact_digital_traffic", "Digital traffic for every market, device, browser and day",
      "Every market has a row per device and browser on every day in the range.", expected,
      expected - tr[["date", "market_code", "device_type", "browser"]].drop_duplicates().shape[0])

    n_periods = periods["period_key"].nunique()
    expected = len(stores) * n_periods
    c("CMP-06", "fact_targets", "Targets for every store and period",
      "Every store has a target row for every business period, including future ones.", expected,
      expected - t["fact_targets"][["store_id", "period_key"]].drop_duplicates().shape[0])

    expected = markets * n_periods
    c("CMP-07", "fact_digital_targets", "Digital targets for every market and period",
      "Every market has a digital target row for every business period.", expected,
      expected - t["fact_digital_targets"][["market_code", "period_key"]].drop_duplicates().shape[0])

    # store-periods that traded need a P&L row. Online has no store P&L by design.
    period_of_day = dim_date.assign(full_date=days).set_index("full_date")["period_key"]
    trading_sales = sales.loc[sales["store_id"].isin(trading), ["date", "store_id"]]
    trading_sales = trading_sales.assign(period_key=as_datetime(trading_sales["date"]).map(period_of_day))
    traded = trading_sales[["store_id", "period_key"]].drop_duplicates()
    have_pnl = t["fact_store_finance"][["store_id", "period_key"]].drop_duplicates()
    missing = traded.merge(have_pnl, how="left", on=["store_id", "period_key"], indicator=True)["_merge"].eq("left_only").sum()
    c("CMP-08", "fact_store_finance", "A P&L row for every store-period that traded",
      "Every non-online store-period with sales has a row in fact_store_finance.", len(traded), missing)

    stock = t["fact_stock_snapshot"][["week_ending_date", "store_id"]].drop_duplicates()
    expected = stock["week_ending_date"].nunique() * stock["store_id"].nunique()
    c("CMP-09", "fact_stock_snapshot", "A stock snapshot for every store, every week",
      "Every store appears in every weekly snapshot.", expected, expected - len(stock))

    fx = t["fx_rate_monthly"]
    sales_months = as_datetime(sales["date"]).dt.to_period("M").drop_duplicates()
    fx_pairs = set(zip(as_datetime(fx["month_start"]).dt.to_period("M"), fx["currency_code"]))
    needed = [(m, ccy) for m in sales_months for ccy in t["dim_currency"]["currency_code"]]
    c("CMP-10", "fx_rate_monthly", "An FX rate for every currency in every month with sales",
      "No sales month is missing an exchange rate for any currency.", len(needed),
      sum(1 for pair in needed if pair not in fx_pairs))

    # advisory: not wrong, just worth knowing
    sold_skus = set(sales["sku"].unique())
    never_sold = (~t["dim_product"]["sku"].isin(sold_skus)).sum()
    c("CMP-11", "dim_product", "Every SKU has sold at least once",
      "SKUs in the product dimension with no sales lines at all.", len(t["dim_product"]), never_sold, "Advisory")

    sold_stores = set(sales["store_id"].unique())
    c("CMP-12", "dim_store", "Every store has sold something",
      "Stores in the dimension with no sales lines at all.", len(stores), (~stores["store_id"].isin(sold_stores)).sum(), "Advisory")

    quiet = ((footfall["footfall"] > 0) & (footfall["transactions"] == 0)).sum()
    c("CMP-13", "fact_footfall", "Store-days with visitors also have sales",
      "Store-days that recorded visitors but rang up no transactions.", len(footfall), quiet, "Advisory")


# --------------------------------------------------------------------------
# reconciliation
# --------------------------------------------------------------------------
def check_reconciliation(audit: Audit, t: dict[str, pd.DataFrame]) -> None:
    sales, stores, dim_date = t["fact_sales"], t["dim_store"], t["dim_date"]
    sale_days = as_datetime(sales["date"])
    not_return = ~sales["is_return"]

    def tie(check_id, table, name, desc, a_label, a, b_label, b, tol):
        joined = pd.concat([a.rename("a"), b.rename("b")], axis=1).fillna(0.0)
        failed = ((joined["a"] - joined["b"]).abs() > tol).sum()
        audit.add(check_id, "Reconciliation", table, name, desc, len(joined), failed,
                  source_a=(a_label, joined["a"].sum()), source_b=(b_label, joined["b"].sum()))

    # finance vs sales, per store-period (Online has no store P&L)
    period_of_day = dim_date.assign(full_date=as_datetime(dim_date["full_date"])).set_index("full_date")["period_key"]
    trading = stores.loc[stores["channel"] != "Online", "store_id"]
    is_trading = sales["store_id"].isin(trading)
    trading_lines = sales.loc[is_trading, ["store_id", "net_sales_gbp"]]
    line_period = sale_days[is_trading].map(period_of_day).rename("period_key")
    by_period = trading_lines.groupby(["store_id", line_period])["net_sales_gbp"].sum()
    fin = t["fact_store_finance"].set_index(["store_id", "period_key"])["net_sales_gbp"]
    matched = by_period.reindex(fin.index)
    tie("REC-01", "fact_store_finance", "Finance net sales = sales net sales",
        f"Per store-period, the P&L's net sales agree with fact_sales to within \u00a3{MONEY_TOLERANCE_GBP:.0f}.",
        "fact_sales (GBP)", matched, "fact_store_finance (GBP)", fin, MONEY_TOLERANCE_GBP)

    # digital vs the Online channel in fact_sales, per market-day, BEFORE returns
    market_of_store = stores.set_index("store_id")["market_code"]
    online_ids = stores.loc[stores["channel"] == "Online", "store_id"]
    is_online_sale = not_return & sales["store_id"].isin(online_ids)
    online = sales.loc[is_online_sale].assign(
        market_code=sales.loc[is_online_sale, "store_id"].map(market_of_store), day=sale_days[is_online_sale]
    )
    online_day = online.groupby(["day", "market_code"]).agg(net=("net_sales_gbp", "sum"), invoices=("invoice_id", "nunique"))
    dg = t["fact_digital_sales"].assign(day=as_datetime(t["fact_digital_sales"]["date"]))
    digital_day = dg.groupby(["day", "market_code"]).agg(net=("net_sales_gbp", "sum"), orders=("orders", "sum"))

    tie("REC-02", "fact_digital_sales", "Digital net sales = Online sales before returns",
        f"Per market-day, digital net sales agree with the Online channel in fact_sales, before returns, to within \u00a3{MONEY_TOLERANCE_GBP:.0f}.",
        "Online sales, before returns (GBP)", online_day["net"], "fact_digital_sales (GBP)", digital_day["net"], MONEY_TOLERANCE_GBP)
    tie("REC-03", "fact_digital_sales", "Digital orders = Online invoices before returns",
        "Per market-day, digital orders equal the number of non-return Online invoices.",
        "Online invoices", online_day["invoices"].astype(float), "fact_digital_sales orders", digital_day["orders"].astype(float), 0.5)

    # footfall vs sales, per store-day, BEFORE returns
    ff = t["fact_footfall"].assign(day=as_datetime(t["fact_footfall"]["date"])).set_index(["day", "store_id"])
    in_footfall = not_return & sales["store_id"].isin(ff.index.get_level_values("store_id").unique())
    counted = sales.loc[in_footfall, ["store_id", "invoice_id", "quantity"]]
    keys = [sale_days[in_footfall].rename("day"), counted["store_id"]]
    invoices = counted.groupby(keys)["invoice_id"].nunique().reindex(ff.index).fillna(0)
    units = counted.groupby(keys)["quantity"].sum().reindex(ff.index).fillna(0)
    tie("REC-04", "fact_footfall", "Footfall transactions = sales invoices before returns",
        "Per store-day, footfall transactions equal the number of non-return invoices in fact_sales.",
        "fact_sales invoices", invoices.astype(float), "fact_footfall transactions", ff["transactions"].astype(float), 0.5)
    tie("REC-05", "fact_footfall", "Footfall units = sales units before returns",
        "Per store-day, footfall units_sold equal the non-return units in fact_sales.",
        "fact_sales units", units.astype(float), "fact_footfall units_sold", ff["units_sold"].astype(float), 0.5)

    # web export vs warehouse, per store-day (only if the export has been built)
    export_path = EXPORTS / "fact_sales_daily.parquet"
    if export_path.exists():
        exp = pd.read_parquet(export_path, columns=["date", "store_id", "net_sales_gbp"])
        exp = exp.assign(day=as_datetime(exp["date"])).groupby(["day", "store_id"])["net_sales_gbp"].sum()
        wh = sales.groupby([sale_days.rename("day"), "store_id"])["net_sales_gbp"].sum()
        tie("REC-06", "fact_sales", "Web app export = warehouse net sales",
            "Per store-day, the data/exports file the web app reads matches fact_sales, so the report and the web app tell the same story.",
            "fact_sales warehouse (GBP)", wh, "web export (GBP)", exp, 0.01)
    else:
        print("note: data/exports/fact_sales_daily.parquet not found, skipping the web export reconciliation")


# --------------------------------------------------------------------------
# freshness
# --------------------------------------------------------------------------
def check_freshness(audit: Audit, run_date: dt.date) -> dict[str, dt.date]:
    latest: dict[str, dt.date] = {}
    for i, (table, (col, allowed_lag)) in enumerate(FRESHNESS_RULES.items(), start=1):
        latest[table] = as_datetime(load(table, [col])[col]).max().date()
        lag = (run_date - latest[table]).days
        audit.add(
            f"FRS-{i:02d}", "Freshness", table,
            f"{table} is up to date",
            f"The latest {table} date is within {allowed_lag} day(s) of the run date.",
            1, 0 if lag <= allowed_lag else 1,
        )
    return latest


# --------------------------------------------------------------------------
# cleaning: what clean_fact_sales.py fixed, read from the raw file
# --------------------------------------------------------------------------
def check_cleaning(audit: Audit, warehouse_sales_rows: int) -> None:
    if not RAW_SALES_PATH.exists():
        print(f"note: {RAW_SALES_PATH} not found, skipping the cleaning rows (run the full pipeline to include them)")
        return

    raw = pd.read_csv(RAW_SALES_PATH, usecols=["store_id", "currency", "discount_pct"])
    n_raw = len(raw)

    def cl(check_id, name, desc, affected):
        audit.add(check_id, "Cleaning", "fact_sales", name, desc, n_raw, affected, severity="Info", scored=False)

    # clean_fact_sales.py only ever removes rows through drop_duplicates(), so
    # the gap between raw and warehouse row counts is the duplicates it dropped
    cl("CLN-01", "Duplicate lines removed",
       "Exact duplicate lines in the raw file that were dropped (after the fixes below, so some only match once tidied).",
       n_raw - warehouse_sales_rows)
    cl("CLN-02", "Lowercase store IDs corrected",
       "Raw rows where store_id wasn't upper case, so wouldn't have matched dim_store.",
       (raw["store_id"] != raw["store_id"].str.upper()).sum())
    cl("CLN-03", "Currency whitespace stripped",
       "Raw rows where the currency code had stray spaces around it.",
       (raw["currency"] != raw["currency"].str.strip()).sum())
    cl("CLN-04", "Missing discount set to 0%",
       "Raw rows where discount_pct was blank on a full-price line.",
       raw["discount_pct"].isna().sum())


# --------------------------------------------------------------------------
# table profile
# --------------------------------------------------------------------------
def null_cells(path: Path) -> int | None:
    meta = pq.ParquetFile(path).metadata
    total = 0
    for rg in range(meta.num_row_groups):
        for col in range(meta.num_columns):
            stats = meta.row_group(rg).column(col).statistics
            if stats is None or not stats.has_null_count:
                return None
            total += stats.null_count
    return total


def build_profile(run_date: dt.date, latest: dict[str, dt.date]) -> pd.DataFrame:
    rows = []
    own_outputs = {CHECKS_OUT.name, PROFILE_OUT.name}
    for path in sorted(WAREHOUSE.glob("*.parquet")):
        if path.name in own_outputs:
            continue
        name = path.stem
        meta = pq.ParquetFile(path).metadata
        n_rows, n_cols = meta.num_rows, meta.num_columns
        nulls = null_cells(path)

        earliest_date = latest_date = None
        allowed_lag = None
        if name in FRESHNESS_RULES:
            col, allowed_lag = FRESHNESS_RULES[name]
            dates = as_datetime(load(name, [col])[col])
            earliest_date, latest_date = dates.min().date(), latest.get(name, dates.max().date())

        days_behind = (run_date - latest_date).days if latest_date else None
        if latest_date is None:
            freshness = "n/a"
        else:
            freshness = "Fresh" if days_behind <= allowed_lag else "Stale"

        table_type = "Dimension" if name.startswith("dim_") else "Fact" if name.startswith("fact_") else "Reference"
        rows.append(
            {
                "table_name": name,
                "table_type": table_type,
                "grain": GRAIN.get(name, ""),
                "row_count": n_rows,
                "column_count": n_cols,
                "cell_count": n_rows * n_cols,
                "null_cells": nulls,
                "earliest_data_date": earliest_date,
                "latest_data_date": latest_date,
                "run_date": run_date,
                "days_behind_run": days_behind,
                "allowed_lag_days": allowed_lag,
                "freshness_status": freshness,
            }
        )

    df = pd.DataFrame(rows)
    for col in ["null_cells", "days_behind_run", "allowed_lag_days"]:
        df[col] = df[col].astype("Int64")
    return df


def print_summary(checks: pd.DataFrame) -> None:
    scored = checks[checks["counts_toward_score"] == 1]
    print(f"\ndata quality: {len(scored)} scored checks - "
          f"{(scored['status'] == 'Pass').sum()} passed, "
          f"{(scored['status'] == 'Warn').sum()} warnings, "
          f"{(scored['status'] == 'Fail').sum()} failed "
          f"({(scored['status'] == 'Pass').mean():.1%} pass rate)")
    for row in checks[checks["status"].isin(["Warn", "Fail"])].itertuples():
        print(f"  {row.status.upper():4s} {row.check_id}  {row.check_name}: {row.rows_failed:,} of {row.rows_tested:,}")
    for row in checks[checks["category"] == "Cleaning"].itertuples():
        print(f"  FIXED {row.check_id}  {row.check_name}: {row.rows_failed:,} of {row.rows_tested:,}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="exit 1 if any Critical check fails")
    args = parser.parse_args()

    run_ts = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    run_date = dt.date.today()
    audit = Audit(run_ts)

    names = [
        "dim_date", "dim_period", "dim_store", "dim_product", "dim_promo", "dim_currency", "fx_rate_monthly",
        "fact_footfall", "fact_store_finance", "fact_targets", "fact_digital_sales", "fact_digital_traffic",
        "fact_digital_targets",
    ]
    tables = {name: load(name) for name in names}
    tables["fact_sales"] = load("fact_sales", SALES_COLS)
    tables["fact_stock_snapshot"] = load("fact_stock_snapshot", STOCK_COLS)

    check_integrity(audit, tables)
    check_uniqueness(audit, tables)
    check_validity(audit, tables)
    check_completeness(audit, tables)
    check_reconciliation(audit, tables)
    latest = check_freshness(audit, run_date)
    check_cleaning(audit, len(tables["fact_sales"]))

    checks = audit.frame()
    profile = build_profile(run_date, latest)

    CHECKS_OUT.parent.mkdir(parents=True, exist_ok=True)
    checks.to_parquet(CHECKS_OUT, index=False)
    profile.to_parquet(PROFILE_OUT, index=False)
    print(f"dq_check_results: {len(checks)} checks -> {CHECKS_OUT}")
    print(f"dq_table_profile: {len(profile)} tables -> {PROFILE_OUT}")
    print_summary(checks)

    if args.strict and (checks["status"] == "Fail").any():
        sys.exit(1)


if __name__ == "__main__":
    main()