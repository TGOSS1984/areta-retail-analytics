"""
Connects a notebook to the Areta warehouse.

Every notebook in this folder starts with:

    from _setup import q

q() runs a query and shows the result as a table. It uses the same
connection as sql/duck.py, so every warehouse table is there by name
(fact_sales, dim_store, ...), plus v_sales_flat, which is fact_sales with
the store, product, promo and calendar columns already joined on.

The tables are views over the Parquet files in data/warehouse/, so after
a weekly refresh you're querying the new data straight away.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

SQL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SQL_DIR))

from duck import connect  # noqa: E402  (needs the path above)

con = connect()

# Show 20 rows at most, since a notebook saves its results inside the file
# and a big result makes a big file. Numbers get thousands separators, and
# whole numbers (DuckDB returns SUMs as decimals) lose the ".00".
pd.options.display.max_rows = 20
pd.options.display.float_format = lambda x: f"{x:,.0f}" if float(x).is_integer() else f"{x:,.2f}"


def q(sql: str) -> pd.DataFrame:
    """Run one query and return the result as a table."""
    return con.sql(sql).df()