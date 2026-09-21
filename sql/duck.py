"""
duck.py - the doorway into the SQL suite.

DuckDB queries the warehouse's parquet files directly, so there's no database
to install or load. This script points a DuckDB session at data/warehouse/,
gives every parquet file a table-style name (fact_sales, dim_store, ...), and
then does whatever you ask of it:

    python sql/duck.py ui                       open the DuckDB notebook UI in your browser
    python sql/duck.py shell                    a plain SQL prompt in the terminal
    python sql/duck.py run <file.sql>           run a query file and print the results
    python sql/duck.py run <file.sql> --only 3  run just query number 3 in that file
    python sql/duck.py schema [table]           list tables and columns
    python sql/duck.py check                    run every query in the suite and report problems
    python sql/duck.py build                    write sql/warehouse.duckdb for other SQL tools

The tables are views over the parquet files, so when the weekly refresh
rewrites the warehouse you're querying the new data straight away, nothing to
reload.

Query files are split into individual queries by lines that start with "-- ##"
(the text after it is the title), so one file can hold a whole topic. A query
that is SUPPOSED to come back empty (the data quality checks) carries a
"-- expect: no rows" comment so `check` doesn't flag it.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

try:
    import duckdb
except ImportError:
    sys.exit("DuckDB isn't installed yet. Run:  pip install -r sql/requirements.txt")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WAREHOUSE = ROOT / "data" / "warehouse"
DB_FILE = HERE / "warehouse.duckdb"
SUITE_FILES = sorted((HERE / "queries").glob("*.sql")) + [HERE / "practice" / "solutions.sql"]

# One wide table to start on before joins make sense. Every row of fact_sales
# with the store, product, promo and calendar columns already attached.
FLAT_VIEW = """
CREATE OR REPLACE VIEW v_sales_flat AS
SELECT
    f.date, d.business_year, d.business_period_number, d.business_period_label,
    d.business_week_number, d.day_name, d.is_weekend,
    f.store_id, s.store_name, s.channel, s.store_type, s.market_name, s.region,
    f.sku, p.style_code, p.style_name, p.colour, p.size_code, p.brand_name,
    p.division, p.major_product_group, p.product_group, p.gender,
    f.promo_id, pr.promo_name, pr.promo_type,
    f.invoice_id, f.quantity, f.unit_price_gbp, f.net_sales_gbp, f.vat_gbp,
    f.gross_sales_gbp, f.cost_gbp, f.is_return
FROM fact_sales f
JOIN dim_date d     ON f.date = d.full_date
JOIN dim_store s    ON f.store_id = s.store_id
JOIN dim_product p  ON f.sku = p.sku
JOIN dim_promo pr   ON f.promo_id = pr.promo_id
"""


def connect(database: str = ":memory:") -> "duckdb.DuckDBPyConnection":
    if not WAREHOUSE.is_dir() or not list(WAREHOUSE.glob("*.parquet")):
        sys.exit(f"No parquet files in {WAREHOUSE}. Run the generator first (python generator/weekly_refresh.py).")
    con = duckdb.connect(database)
    for path in sorted(WAREHOUSE.glob("*.parquet")):
        # absolute paths, so it works whichever folder the session was started from
        con.execute(f"CREATE OR REPLACE VIEW \"{path.stem}\" AS SELECT * FROM read_parquet('{path.as_posix()}')")
    con.execute(FLAT_VIEW)
    return con


def split_queries(text: str) -> list[tuple[str, str]]:
    """Split a query file into (title, sql) pairs on '-- ##' marker lines."""
    parts = re.split(r"(?m)^-- ##[ \t]*", text)
    queries = []
    for part in parts[1:]:  # parts[0] is the file header comment
        title, _, sql = part.partition("\n")
        if sql.strip():
            queries.append((title.strip(), sql.strip()))
    return queries


def run_sql(con, sql: str):
    """Run one or more statements, return the last statement's relation."""
    statements = con.extract_statements(sql)
    result = None
    for i, statement in enumerate(statements):
        if i < len(statements) - 1:
            con.execute(statement.query)
        else:
            result = con.sql(statement.query)
    return result


def print_result(rel, max_rows: int) -> None:
    if rel is None:
        print("(no result)")
        return
    rel.show(max_rows=max_rows, max_width=220)


def cmd_run(args) -> None:
    path = Path(args.file)
    if not path.is_absolute() and not path.exists():
        path = HERE / args.file  # allow: run queries/03_aggregation.sql
    if not path.exists():
        sys.exit(f"Can't find {args.file}")
    queries = split_queries(path.read_text(encoding="utf-8"))
    if not queries:
        sys.exit("No queries found. Each query needs a '-- ## title' line above it.")

    con = connect()
    for number, (title, sql) in enumerate(queries, start=1):
        if args.only and args.only.lower() not in (str(number), title.lower()) and args.only.lower() not in title.lower():
            continue
        print(f"\n[{number}] {title}")
        print("-" * (len(title) + 6))
        try:
            print_result(run_sql(con, sql), args.rows)
        except duckdb.Error as err:
            print(f"ERROR: {err}")


def cmd_check(args) -> None:
    con = connect()
    problems, total = [], 0
    for path in SUITE_FILES:
        if not path.exists():
            continue
        queries = split_queries(path.read_text(encoding="utf-8"))
        ok = 0
        for number, (title, sql) in enumerate(queries, start=1):
            total += 1
            start = time.perf_counter()
            try:
                rel = run_sql(con, sql)
                rows = len(rel.fetchall()) if rel is not None else 0
                seconds = time.perf_counter() - start
                expects_empty = "-- expect: no rows" in sql
                if rows == 0 and not expects_empty:
                    problems.append(f"{path.name} [{number}] {title}: returned no rows")
                elif rows > 0 and expects_empty:
                    problems.append(f"{path.name} [{number}] {title}: should be empty but returned {rows} row(s)")
                elif args.verbose:
                    print(f"  ok  {path.name} [{number}] {title}  ({rows} rows, {seconds:.1f}s)")
                ok += 1
            except duckdb.Error as err:
                problems.append(f"{path.name} [{number}] {title}: {str(err).splitlines()[0]}")
        print(f"{path.name}: {ok} of {len(queries)} ran")
    print(f"\n{total} queries checked, {len(problems)} problem(s)")
    for line in problems:
        print("  -", line)
    if problems:
        sys.exit(1)


def cmd_schema(args) -> None:
    con = connect()
    if args.table:
        con.sql(f'DESCRIBE "{args.table}"').show(max_rows=200, max_width=200)
        return
    tables = [r[0] for r in con.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY 1").fetchall()]
    for name in tables:
        rows = con.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        if getattr(args, "short", False):
            print(f"{name:<24}{rows:>12,} rows")
            continue
        cols = [r[0] for r in con.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position", [name]).fetchall()]
        print(f"\n{name}  ({rows:,} rows)\n  " + ", ".join(cols))


def cmd_shell(args) -> None:
    con = connect()
    print("SQL prompt on the warehouse. End each query with ;   Type .help for commands, .quit to leave.")
    buffer: list[str] = []
    while True:
        try:
            line = input("sql> " if not buffer else "  -> ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        stripped = line.strip()
        if not buffer and stripped.startswith("."):
            command, _, rest = stripped.partition(" ")
            if command in (".quit", ".exit", ".q"):
                break
            elif command == ".help":
                print(".tables            list tables\n.schema <table>    columns of a table\n.run <file.sql>    run a query file\n.quit              leave")
            elif command == ".tables":
                cmd_schema(argparse.Namespace(table=None, short=True))
            elif command == ".schema" and rest:
                con.sql(f'DESCRIBE "{rest.strip()}"').show(max_rows=200, max_width=200)
            elif command == ".run" and rest:
                cmd_run(argparse.Namespace(file=rest.strip(), only=None, rows=25))
            else:
                print("Unknown command, try .help")
            continue
        buffer.append(line)
        if stripped.endswith(";"):
            sql = "\n".join(buffer)
            buffer = []
            try:
                print_result(run_sql(con, sql), 40)
            except duckdb.Error as err:
                print(f"ERROR: {err}")


def cmd_ui(args) -> None:
    con = connect()
    # the UI attaches to this same session, so the table names above just work in its notebooks
    con.execute("CALL start_ui()")
    print("The DuckDB UI is open in your browser (first run downloads the ui extension, so it needs internet once).")
    print("Your tables are in the left-hand list. Leave this window open while you work.")
    input("Press Enter here to stop it.\n")


def cmd_build(args) -> None:
    if DB_FILE.exists():
        DB_FILE.unlink()
    connect(str(DB_FILE)).close()
    # the database file is rebuilt on demand, so keep it out of git
    ignore = HERE / ".gitignore"
    if not ignore.exists():
        ignore.write_text("# made by `python sql/duck.py build`, safe to delete and rebuild\n*.duckdb\n*.duckdb.wal\n", encoding="utf-8")
    print(f"Wrote {DB_FILE}. Point DBeaver or any DuckDB client at it; it holds views onto data/warehouse/.")


def main() -> None:
    parser = argparse.ArgumentParser(description="SQL suite for the Areta warehouse")
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("run", help="run a query file")
    p.add_argument("file")
    p.add_argument("--only", help="run just this query (its number or part of its title)")
    p.add_argument("--rows", type=int, default=25, help="max rows to print per query")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("check", help="run every query in the suite")
    p.add_argument("-v", "--verbose", action="store_true")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("schema", help="list tables and columns")
    p.add_argument("table", nargs="?")
    p.add_argument("--short", action="store_true", help="table names and row counts only")
    p.set_defaults(func=cmd_schema)

    sub.add_parser("shell", help="interactive SQL prompt").set_defaults(func=cmd_shell)
    sub.add_parser("ui", help="open the DuckDB notebook UI").set_defaults(func=cmd_ui)
    sub.add_parser("build", help="write sql/warehouse.duckdb").set_defaults(func=cmd_build)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return
    args.func(args)


if __name__ == "__main__":
    main()