"""
weekly_refresh.py

Single entry point that runs the whole generator pipeline in the order it
actually needs to run in — this is what the GitHub Action calls on a
schedule, and what "just rebuild everything" means locally too.

Order matters here, not arbitrary:
  1. dimensions (date, store, product, currency, promo) — nothing else can
     run without these
  2. fact_sales raw pass, then its clean step — fact_footfall, fact_targets,
     and fact_stock_snapshot all read the CLEANED fact_sales, not the raw one
  3. fact_footfall, fact_targets, fact_stock_snapshot — order between these
     three doesn't matter, they're independent of each other, just all
     downstream of fact_sales

Each step runs as its own subprocess rather than an import, mainly so this
behaves the same locally as it will from CI — one failing step stops the
whole run rather than silently leaving downstream tables stale.

Usage:
    python weekly_refresh.py
"""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

GEN_ROOT = Path(__file__).resolve().parent

STEPS = [
    ("dimensions/build_dim_date.py", "dim_date"),
    ("dimensions/build_dim_store.py", "dim_store"),
    ("dimensions/build_dim_product.py", "dim_product"),
    ("dimensions/build_dim_currency.py", "dim_currency + fx_rate_monthly"),
    ("dimensions/build_dim_promo.py", "dim_promo"),
    ("facts/build_fact_sales.py", "fact_sales (raw)"),
    ("clean/clean_fact_sales.py", "fact_sales (staging + warehouse)"),
    ("facts/build_fact_footfall.py", "fact_footfall"),
    ("facts/build_fact_targets.py", "fact_targets"),
    ("facts/build_fact_stock.py", "fact_stock_snapshot"),
]


def run_step(script_rel_path: str, label: str) -> None:
    script_path = GEN_ROOT / script_rel_path
    print(f"\n--- {label} ({script_rel_path}) ---")
    start = time.time()

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=script_path.parent,
        capture_output=True,
        text=True,
    )
    elapsed = time.time() - start

    if result.stdout:
        print(result.stdout.strip())

    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        print(f"\n[weekly_refresh] FAILED at '{label}' after {elapsed:.1f}s — stopping, nothing after this ran.")
        sys.exit(1)

    print(f"[weekly_refresh] {label} done in {elapsed:.1f}s")


def main() -> None:
    overall_start = time.time()
    for script_rel_path, label in STEPS:
        run_step(script_rel_path, label)

    total = time.time() - overall_start
    print(f"\n[weekly_refresh] all {len(STEPS)} steps completed in {total:.1f}s")


if __name__ == "__main__":
    main()