"""
dim_store builder.

Reads config/markets.yml and generates the store network — one row per
store, weighted across markets by store_weight, split into owned retail vs
concession using each market's channel_mix.

This one's a clean build straight to data/warehouse, no raw/staging pass.
There's nothing meaningfully "messy" about a store list the way there is
about a season of daily sales rows — the cleaning pipeline is really there
for the fact tables, not the dimensions.

Usage:
    python build_dim_store.py
"""

from __future__ import annotations

import random
from pathlib import Path

import pandas as pd
import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "markets.yml"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_store.parquet"

TOTAL_STORES = 350
RANDOM_SEED = 42  # fixed so re-running this doesn't reshuffle the whole store list

# A handful of real cities per market. Real city names are just geography,
# not anyone's proprietary data — it's only the store/brand names attached
# to them below that are invented.
CITIES = {
    "UK": [
        "London", "Manchester", "Birmingham", "Leeds", "Bristol", "Newcastle",
        "Sheffield", "Nottingham", "Liverpool", "York", "Cardiff", "Edinburgh",
        "Glasgow", "Belfast", "Oxford", "Cambridge", "Bath", "Chester",
    ],
    "DE": [
        "Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Stuttgart",
        "Dusseldorf", "Leipzig", "Dresden", "Nuremberg",
    ],
    "PL": ["Warsaw", "Krakow", "Gdansk", "Wroclaw", "Poznan", "Lodz", "Katowice"],
    "IE": ["Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny"],
    "IT": ["Milan", "Rome", "Turin", "Bologna", "Verona", "Florence"],
    "NL": ["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven", "The Hague"],
    "CZ": ["Prague", "Brno", "Ostrava"],
    "SK": ["Bratislava", "Kosice"],
    "FR": ["Paris", "Lyon", "Marseille", "Toulouse"],
    "LV": ["Riga", "Daugavpils", "Liepaja"],
    "LT": ["Vilnius", "Kaunas", "Klaipeda"],
}

# Fictional concession partners — generic retail-park / garden-centre /
# department-store types, standing in for the kind of host retailer a
# concession store would actually sit inside.
CONCESSION_PARTNERS = [
    "Fernbank Garden Centre", "Northfield Home & Garden", "Solstice Outlets",
    "Harbourside Retail Park", "Millbrook Department Store", "Cornerstone Outlet",
    "Greenway Garden Centre", "Ridgeway Home Store", "Anchor Point Retail",
    "Westgate Shopping Centre",
]


def load_markets() -> list[dict]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    return cfg["markets"]


def build() -> pd.DataFrame:
    rng = random.Random(RANDOM_SEED)
    markets = load_markets()
    rows = []
    store_id = 1

    for market in markets:
        code = market["code"]
        store_count = round(TOTAL_STORES * market["store_weight"])
        concession_share = market["channel_mix"]["concession"]
        concession_count = round(store_count * concession_share)
        retail_count = store_count - concession_count
        cities = CITIES.get(code, [market["name"]])

        for _ in range(retail_count):
            city = rng.choice(cities)
            rows.append(
                {
                    "store_id": f"ST{store_id:04d}",
                    "store_name": f"Areta {city}",
                    "channel": "Retail",
                    "market_code": code,
                    "market_name": market["name"],
                    "city": city,
                    "currency": market["currency"],
                    "is_home_market": market["is_home_market"],
                }
            )
            store_id += 1

        for _ in range(concession_count):
            city = rng.choice(cities)
            partner = rng.choice(CONCESSION_PARTNERS)
            rows.append(
                {
                    "store_id": f"ST{store_id:04d}",
                    "store_name": f"{partner} \u2014 {city}",
                    "channel": "Concession",
                    "market_code": code,
                    "market_name": market["name"],
                    "city": city,
                    "currency": market["currency"],
                    "is_home_market": market["is_home_market"],
                }
            )
            store_id += 1

    df = pd.DataFrame(rows)

    # small city lists mean a couple of names will legitimately collide —
    # de-dupe by suffixing a number rather than silently dropping rows
    df["dupe_rank"] = df.groupby(["market_code", "store_name"]).cumcount()
    df["store_name"] = df.apply(
        lambda r: r["store_name"] if r["dupe_rank"] == 0 else f"{r['store_name']} ({r['dupe_rank'] + 1})",
        axis=1,
    )
    return df.drop(columns="dupe_rank")


def main() -> None:
    df = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"dim_store: {len(df):,} rows across {df['market_code'].nunique()} markets -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()