"""
dim_store builder.

Reads config/markets.yml and generates the store network — one row per
store, weighted across markets by store_weight, split into owned retail vs
concession using each market's channel_mix. Also assigns store_type
(High Street/Retail Park/Shopping Centre/Outlet for retail; the host
format itself — Garden Centre, Department Store etc — for concessions,
since that IS the concession's format), a coarse region within each
market, and a jittered latitude/longitude around that city's centre.

Coordinates live here (store grain), not in a separate region table —
a region-level view (for the web app's map, eventually) is a derived
average of its stores' coordinates, computed at query time, not a second
independently-maintained set of positions that could drift out of sync
with this one.

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

# Region within each market — used to tag store_type/region attributes
# below. Coarse groupings, not administrative boundaries.
CITY_TO_REGION = {
    # UK
    "London": "London", "Manchester": "North England", "Birmingham": "Midlands",
    "Leeds": "North England", "Bristol": "South West", "Newcastle": "North England",
    "Sheffield": "North England", "Nottingham": "Midlands", "Liverpool": "North England",
    "York": "North England", "Cardiff": "Wales", "Edinburgh": "Scotland",
    "Glasgow": "Scotland", "Belfast": "Northern Ireland", "Oxford": "South East",
    "Cambridge": "South East", "Bath": "South West", "Chester": "North England",
    # DE
    "Berlin": "East", "Munich": "South", "Hamburg": "North", "Cologne": "West",
    "Frankfurt": "Central", "Stuttgart": "South", "Dusseldorf": "West",
    "Leipzig": "East", "Dresden": "East", "Nuremberg": "South",
    # PL
    "Warsaw": "Central", "Krakow": "South", "Gdansk": "North", "Wroclaw": "West",
    "Poznan": "West", "Lodz": "Central", "Katowice": "South",
    # IE
    "Dublin": "Leinster", "Cork": "Munster", "Galway": "Connacht",
    "Limerick": "Munster", "Waterford": "Munster", "Kilkenny": "Leinster",
    # IT
    "Milan": "North", "Rome": "Central", "Turin": "North", "Bologna": "North",
    "Verona": "North", "Florence": "Central",
    # NL
    "Amsterdam": "West", "Rotterdam": "West", "Utrecht": "West",
    "Eindhoven": "South", "The Hague": "West",
    # CZ
    "Prague": "Bohemia", "Brno": "Moravia", "Ostrava": "Moravia",
    # SK
    "Bratislava": "West", "Kosice": "East",
    # FR
    "Paris": "Ile-de-France", "Lyon": "Rhone-Alpes", "Marseille": "PACA", "Toulouse": "Occitanie",
    # LV
    "Riga": "Riga Region", "Daugavpils": "Latgale", "Liepaja": "Kurzeme",
    # LT
    "Vilnius": "Vilnius Region", "Kaunas": "Kaunas Region", "Klaipeda": "Klaipeda Region",
}

RETAIL_STORE_TYPES = ["High Street", "Retail Park", "Shopping Centre", "Outlet"]
RETAIL_STORE_TYPE_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

# City-centre coordinates (decimal degrees) — approximate, a real store's
# actual address would sit a few streets off these, which is exactly what
# the per-store jitter below is for. Enough precision for what this is
# actually used for: a store-level bubble map in Power BI, and (via an
# aggregate, not a separate table) a regional map in the web app later.
# Not meant to withstand someone checking an individual store's exact
# real-world address.
CITY_COORDINATES = {
    # UK
    "London": (51.5074, -0.1278), "Manchester": (53.4808, -2.2426),
    "Birmingham": (52.4862, -1.8904), "Leeds": (53.8008, -1.5491),
    "Bristol": (51.4545, -2.5879), "Newcastle": (54.9783, -1.6178),
    "Sheffield": (53.3811, -1.4701), "Nottingham": (52.9548, -1.1581),
    "Liverpool": (53.4084, -2.9916), "York": (53.9600, -1.0873),
    "Cardiff": (51.4816, -3.1791), "Edinburgh": (55.9533, -3.1883),
    "Glasgow": (55.8642, -4.2518), "Belfast": (54.5973, -5.9301),
    "Oxford": (51.7520, -1.2577), "Cambridge": (52.2053, 0.1218),
    "Bath": (51.3811, -2.3590), "Chester": (53.1934, -2.8931),
    # DE
    "Berlin": (52.5200, 13.4050), "Munich": (48.1351, 11.5820),
    "Hamburg": (53.5511, 9.9937), "Cologne": (50.9375, 6.9603),
    "Frankfurt": (50.1109, 8.6821), "Stuttgart": (48.7758, 9.1829),
    "Dusseldorf": (51.2277, 6.7735), "Leipzig": (51.3397, 12.3731),
    "Dresden": (51.0504, 13.7373), "Nuremberg": (49.4521, 11.0767),
    # PL
    "Warsaw": (52.2297, 21.0122), "Krakow": (50.0647, 19.9450),
    "Gdansk": (54.3520, 18.6466), "Wroclaw": (51.1079, 17.0385),
    "Poznan": (52.4064, 16.9252), "Lodz": (51.7592, 19.4560),
    "Katowice": (50.2649, 19.0238),
    # IE
    "Dublin": (53.3498, -6.2603), "Cork": (51.8985, -8.4756),
    "Galway": (53.2707, -9.0568), "Limerick": (52.6638, -8.6267),
    "Waterford": (52.2593, -7.1101), "Kilkenny": (52.6541, -7.2448),
    # IT
    "Milan": (45.4642, 9.1900), "Rome": (41.9028, 12.4964),
    "Turin": (45.0703, 7.6869), "Bologna": (44.4949, 11.3426),
    "Verona": (45.4384, 10.9916), "Florence": (43.7696, 11.2558),
    # NL
    "Amsterdam": (52.3676, 4.9041), "Rotterdam": (51.9244, 4.4777),
    "Utrecht": (52.0907, 5.1214), "Eindhoven": (51.4416, 5.4697),
    "The Hague": (52.0705, 4.3007),
    # CZ
    "Prague": (50.0755, 14.4378), "Brno": (49.1951, 16.6068),
    "Ostrava": (49.8209, 18.2625),
    # SK
    "Bratislava": (48.1486, 17.1077), "Kosice": (48.7164, 21.2611),
    # FR
    "Paris": (48.8566, 2.3522), "Lyon": (45.7640, 4.8357),
    "Marseille": (43.2965, 5.3698), "Toulouse": (43.6047, 1.4442),
    # LV
    "Riga": (56.9496, 24.1052), "Daugavpils": (55.8747, 26.5363),
    "Liepaja": (56.5089, 21.0111),
    # LT
    "Vilnius": (54.6872, 25.2797), "Kaunas": (54.8985, 23.9036),
    "Klaipeda": (55.7033, 21.1443),
}

# Degrees of random jitter applied per store so multiple stores in the
# same city don't render as one overlapping dot on a map. ~0.03deg is
# roughly 2-3km at these latitudes — enough visual separation, small
# enough that every store still clearly reads as "that city".
COORD_JITTER_DEGREES = 0.03

# Fictional concession partners — generic retail-park / garden-centre /
# department-store types, standing in for the kind of host retailer a
# concession store would actually sit inside.
CONCESSION_PARTNERS = [
    "Fernbank Garden Centre", "Northfield Home & Garden", "Solstice Outlets",
    "Harbourside Retail Park", "Millbrook Department Store", "Cornerstone Outlet",
    "Greenway Garden Centre", "Ridgeway Home Store", "Anchor Point Retail",
    "Westgate Shopping Centre",
]

# store_type for a concession is really the HOST's format, not a separate
# random draw — a concession inside a garden centre IS a "Garden Centre"
# store, that's the whole point of the channel
CONCESSION_PARTNER_TYPE = {
    "Fernbank Garden Centre": "Garden Centre",
    "Northfield Home & Garden": "Garden Centre",
    "Solstice Outlets": "Outlet",
    "Harbourside Retail Park": "Retail Park",
    "Millbrook Department Store": "Department Store",
    "Cornerstone Outlet": "Outlet",
    "Greenway Garden Centre": "Garden Centre",
    "Ridgeway Home Store": "Department Store",
    "Anchor Point Retail": "Retail Park",
    "Westgate Shopping Centre": "Shopping Centre",
}


def jittered_coords(city: str, market_name: str, rng: random.Random) -> tuple[float, float]:
    lat, lon = CITY_COORDINATES.get(city, (None, None))
    if lat is None:
        raise KeyError(f"no coordinates for '{city}' ({market_name}) — add it to CITY_COORDINATES")
    return (
        round(lat + rng.uniform(-COORD_JITTER_DEGREES, COORD_JITTER_DEGREES), 5),
        round(lon + rng.uniform(-COORD_JITTER_DEGREES, COORD_JITTER_DEGREES), 5),
    )


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
            store_type = rng.choices(RETAIL_STORE_TYPES, weights=RETAIL_STORE_TYPE_WEIGHTS, k=1)[0]
            lat, lon = jittered_coords(city, market["name"], rng)
            rows.append(
                {
                    "store_id": f"ST{store_id:04d}",
                    "store_name": f"Areta {city}",
                    "channel": "Retail",
                    "store_type": store_type,
                    "market_code": code,
                    "market_name": market["name"],
                    "city": city,
                    "region": CITY_TO_REGION.get(city, market["name"]),
                    "latitude": lat,
                    "longitude": lon,
                    "currency": market["currency"],
                    "is_home_market": market["is_home_market"],
                }
            )
            store_id += 1

        for _ in range(concession_count):
            city = rng.choice(cities)
            partner = rng.choice(CONCESSION_PARTNERS)
            lat, lon = jittered_coords(city, market["name"], rng)
            rows.append(
                {
                    "store_id": f"ST{store_id:04d}",
                    "store_name": f"{partner} \u2014 {city}",
                    "channel": "Concession",
                    "store_type": CONCESSION_PARTNER_TYPE[partner],
                    "market_code": code,
                    "market_name": market["name"],
                    "city": city,
                    "region": CITY_TO_REGION.get(city, market["name"]),
                    "latitude": lat,
                    "longitude": lon,
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