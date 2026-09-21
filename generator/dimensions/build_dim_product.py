"""
dim_product builder.

Expands config/brands.yml (brand -> division -> major product group ->
product group) into actual style/colour/size rows — that's the grain
fact_sales and fact_stock will report against, same as a real product
hierarchy.

A "style" here is one distinct design within a product group (a specific
jacket, say), which fans out into a few colourways, which each fan out into
a size range appropriate to the category. Style names lean on real
mountain/place names (Glencoe, Snowdon, Chamonix...) rather than a random
word generator — reads a lot more like an actual outdoor brand's range, and
place names aren't anyone's IP to worry about.

One deliberate override: Camping & Equipment doesn't fan out by gender even
for brands that sell Mens/Womens/Kids apparel — a rucksack or a tent being
split into "Mens" and "Womens" versions isn't how that category actually
works in the real hierarchy this was modelled on, so it's forced to Unisex
regardless of what the brand's gender list says.

Also works out, for every SKU, which image file Power BI should show. Power
BI can't check whether a URL exists (a calculated column can't make an HTTP
request), so this script decides at build time by looking at what's actually
in web/public/images/. See resolve_image() for the fallback order.

Straight to data/warehouse, same as dim_store — no raw/staging pass needed
for a generated hierarchy like this.

Usage:
    python build_dim_product.py
"""

from __future__ import annotations

import os
import random
import re
import subprocess
from pathlib import Path

import pandas as pd
import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "brands.yml"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "warehouse" / "dim_product.parquet"

# product photography and the placeholder images live in the web app's public
# folder so the web app and Power BI (via raw.githubusercontent.com) share one
# set of files
IMAGES_DIR = Path(__file__).resolve().parents[2] / "web" / "public" / "images"
PRODUCT_IMAGES_DIR = IMAGES_DIR / "products"
PLACEHOLDER_DIR = PRODUCT_IMAGES_DIR / "categories"
IMAGE_EXTENSIONS = (".webp", ".png", ".jpg", ".jpeg")

# the original one-tile-per-major-group set (see categories/README.md). Kept as
# the last resort so nothing that already worked stops working.
LEGACY_CATEGORY_ICONS = {
    "Outerwear": "jacket", "Midlayer": "hanger-2", "Legwear": "hanger",
    "Tops": "shirt", "Accessories": "sock", "Footwear": "shoe",
    "Camping & Equipment": "backpack",
}

RANDOM_SEED = 7

# These two are the main levers on total row count — check the printed
# summary after running and dial them down if it comes out bigger than
# feels right for the project.
STYLES_PER_COMBO = (1, 3)   # distinct styles per brand/division/gender/product group
COLOURS_PER_STYLE = (2, 3)
COST_RATIO_RANGE = (0.28, 0.38)  # cost as a share of base price — i.e. ~62-72% gross margin, set per style not per colour/size

PLACE_NAMES = [
    "Glencoe", "Snowdon", "Ben Nevis", "Skiddaw", "Helvellyn", "Cairngorm",
    "Pen y Fan", "Scafell", "Kinder", "Torridon", "Cuillin", "Brecon",
    "Eiger", "Zermatt", "Chamonix", "Tatra", "Fitzroy", "Kilimanjaro",
    "Annapurna", "Denali", "Aconcagua", "Triglav", "Sarek", "Dolomite",
]

COLOURS = [
    "Forest Green", "Charcoal", "Navy", "Burnt Orange", "Slate Grey",
    "Cream", "Black", "Storm Blue", "Clay Red", "Olive", "Stone",
    "Ink Navy", "Mustard Gold", "Deep Teal", "Ash Grey", "Rust",
]

# Explicit codes rather than colour[:3] — "Storm Blue" and "Stone" both
# truncate to "STO", which was silently producing duplicate SKUs until I
# actually ran this and checked. Every code below needs to stay unique if
# more colours get added later.
COLOUR_CODES = {
    "Forest Green": "FOR", "Charcoal": "CHR", "Navy": "NVY",
    "Burnt Orange": "BUR", "Slate Grey": "SLT", "Cream": "CRM",
    "Black": "BLK", "Storm Blue": "STB", "Clay Red": "CLY",
    "Olive": "OLV", "Stone": "STN", "Ink Navy": "INK",
    "Mustard Gold": "MUS", "Deep Teal": "DTL", "Ash Grey": "ASH",
    "Rust": "RST",
}

ADULT_CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
KIDS_CLOTHING_SIZES = ["3-4yrs", "5-6yrs", "7-8yrs", "9-10yrs", "11-12yrs", "13-14yrs"]
ADULT_SHOE_SIZES = [str(s) for s in range(6, 13)]   # UK 6-12
KIDS_SHOE_SIZES = ["10", "11", "12", "13", "1", "2", "3"]  # UK junior/youth
ONE_SIZE = ["One Size"]
GLOVES_SOCKS_SIZES = ["S/M", "M/L", "L/XL"]

# size_code stays compact (what's already used in the SKU); size_description
# is the human-readable version — separated out since they were one field
# before. Shoe sizes are numeric strings and get "UK {n}" generated rather
# than listed here.
SIZE_DESCRIPTIONS = {
    "XS": "Extra Small", "S": "Small", "M": "Medium", "L": "Large",
    "XL": "Extra Large", "XXL": "2X Large",
    "3-4yrs": "3-4 Years", "5-6yrs": "5-6 Years", "7-8yrs": "7-8 Years",
    "9-10yrs": "9-10 Years", "11-12yrs": "11-12 Years", "13-14yrs": "13-14 Years",
    "One Size": "One Size",
    "S/M": "Small/Medium", "M/L": "Medium/Large", "L/XL": "Large/Extra Large",
}


def size_description_for(size_code: str) -> str:
    if size_code in SIZE_DESCRIPTIONS:
        return SIZE_DESCRIPTIONS[size_code]
    return f"UK {size_code}"  # shoe sizes — numeric strings, not worth a full lookup table


# sub-brand — a range label within a division, distinct from the brand
# itself (brand.yml's "brand" entries are the actual commercial brands;
# this is closer to a collection name). Apparel gets real variety since
# that's where the real hierarchy this was modelled on showed the most
# sub-brand spread; footwear and camping stay single-labelled, there
# wasn't meaningful sub-brand differentiation there in the reference data.
SUB_BRANDS_BY_DIVISION = {
    "Apparel & Other": (["Core", "Active", "Lifestyle"], [0.60, 0.25, 0.15]),
    "Footwear": (["Core Footwear"], [1.0]),
    "Camping & Equipment": (["Core Equipment"], [1.0]),
}

# season_label a style belongs to — matches dim_date's SS/AW-year format
# exactly, so the two can be joined/compared directly. Weighted toward
# more recent seasons: a live assortment skews toward what's currently
# ranged, not evenly across four years of history. This tags WHICH season
# a style belongs to; it doesn't make demand for older-season styles
# decay over time in fact_sales — that'd be a real product-lifecycle
# simulation, a bigger change than adding the attribute itself.
SEASON_LABELS = ["SS23", "AW23", "SS24", "AW24", "SS25", "AW25", "SS26", "AW26"]
SEASON_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8]  # relative, normalised at sample time

# (min, max) base price in GBP before the brand's price_index is applied.
BASE_PRICE_GBP = {
    "Waterproof Shell": (70, 130),
    "Waterproof Insulated Jacket": (90, 160),
    "Softshell": (55, 95),
    "Baffled/Quilted": (60, 110),
    "Gilets & Bodywarmers": (35, 65),
    "Non-Waterproof Jacket": (45, 85),
    "3 in 1": (110, 180),
    "Fleece": (30, 60),
    "Knitwear, Hoodies & Sweatshirts": (28, 55),
    "Base Layer": (18, 32),
    "Trousers": (35, 65),
    "Shorts": (22, 40),
    "Overtrousers": (30, 55),
    "Leggings/Tights": (18, 32),
    "Skirts": (25, 45),
    "T-Shirts": (14, 26),
    "Shirts": (28, 48),
    "Polo Shirts": (20, 35),
    "Vests": (16, 28),
    "Hats": (10, 20),
    "Gloves": (12, 24),
    "Scarves": (12, 22),
    "Socks": (7, 14),
    "Accessory Sets": (18, 32),
    "Boots": (65, 120),
    "Shoes": (45, 85),
    "Sandals": (30, 55),
    "Wellingtons": (35, 60),
    "Rucksacks": (35, 90),
    "Tents": (80, 220),
    "Sleeping Bags": (40, 95),
    "Camping Accessories": (10, 35),
    "Walking Poles": (25, 45),
}


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def sizes_for(division: str, major_group: str, product_group: str, gender: str) -> list[str]:
    if division == "Footwear":
        return KIDS_SHOE_SIZES if gender == "Kids" else ADULT_SHOE_SIZES
    if division == "Camping & Equipment":
        return ONE_SIZE
    if major_group == "Accessories":
        if product_group in ("Gloves", "Socks"):
            return GLOVES_SOCKS_SIZES
        return ONE_SIZE
    return KIDS_CLOTHING_SIZES if gender == "Kids" else ADULT_CLOTHING_SIZES


def build() -> pd.DataFrame:
    rng = random.Random(RANDOM_SEED)
    cfg = load_config()
    brands = cfg["brands"]
    product_groups = cfg["product_groups"]

    rows = []
    style_seq = 1

    for brand in brands:
        for division in brand["divisions"]:
            # camping gear doesn't fan out by gender in the real hierarchy
            # this was modelled on — force Unisex regardless of the brand's
            # broader gender list
            genders = ["Unisex"] if division == "Camping & Equipment" else brand["genders"]

            for major_group, group_list in product_groups.get(division, {}).items():
                for product_group in group_list:
                    for gender in genders:
                        n_styles = rng.randint(*STYLES_PER_COMBO)
                        for _ in range(n_styles):
                            place = rng.choice(PLACE_NAMES)
                            style_code = f"{brand['code']}{style_seq:05d}"
                            style_name = f"{place} {product_group}"
                            lo, hi = BASE_PRICE_GBP.get(product_group, (20, 50))
                            base_price = round(rng.uniform(lo, hi) * brand["price_index"], 2)
                            cost_price = round(base_price * rng.uniform(*COST_RATIO_RANGE), 2)

                            sub_brand_options, sub_brand_weights = SUB_BRANDS_BY_DIVISION[division]
                            sub_brand = rng.choices(sub_brand_options, weights=sub_brand_weights, k=1)[0]
                            season_label = rng.choices(SEASON_LABELS, weights=SEASON_WEIGHTS, k=1)[0]

                            n_colours = rng.randint(*COLOURS_PER_STYLE)
                            colours = rng.sample(COLOURS, k=n_colours)
                            sizes = sizes_for(division, major_group, product_group, gender)

                            for colour in colours:
                                for size in sizes:
                                    rows.append(
                                        {
                                            "sku": f"{style_code}-{COLOUR_CODES[colour]}-{size}",
                                            "style_code": style_code,
                                            "style_name": style_name,
                                            "brand_code": brand["code"],
                                            "brand_name": brand["name"],
                                            "brand_tier": brand["tier"],
                                            "sub_brand": sub_brand,
                                            "division": division,
                                            "major_product_group": major_group,
                                            "product_group": product_group,
                                            "gender": gender,
                                            "season_label": season_label,
                                            "colour": colour,
                                            "colour_code": COLOUR_CODES[colour],
                                            "size_code": size,
                                            "size_description": size_description_for(size),
                                            "base_price_gbp": base_price,
                                            "cost_price_gbp": cost_price,
                                        }
                                    )
                            style_seq += 1

    return pd.DataFrame(rows)


def slugify(text: str) -> str:
    """'Knitwear, Hoodies & Sweatshirts' -> 'knitwear-hoodies-and-sweatshirts'."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")


def list_files(folder: Path) -> set[str]:
    # exact-case names straight from the directory listing. GitHub's raw URLs
    # are case-sensitive but Windows isn't, so Path.exists() would happily
    # match "Outerwear.webp" locally and then 404 once it's on GitHub.
    if not folder.is_dir():
        return set()
    with os.scandir(folder) as entries:
        return {e.name for e in entries if e.is_file()}


def find_image(stem: str, available: set[str], prefix: str) -> str | None:
    for ext in IMAGE_EXTENSIONS:
        if f"{stem}{ext}" in available:
            return f"{prefix}{stem}{ext}"
    return None


def resolve_image(row, photos: set[str], placeholders: set[str]) -> tuple[str, str]:
    """Best available image for one style/colour, as a path under web/public/images/.

    Order: the style/colour photo, then a placeholder for its product group,
    then one for its major product group, then the original icon tile for the
    major group, then a general default. The first file that exists wins.
    """
    hit = find_image(f"{row.style_code}-{row.colour_code}", photos, "products/")
    if hit:
        return hit, "Style-colour photo"
    prefix = "products/categories/"
    hit = find_image(slugify(row.product_group), placeholders, prefix)
    if hit:
        return hit, "Product group placeholder"
    hit = find_image(slugify(row.major_product_group), placeholders, prefix)
    if hit:
        return hit, "Major group placeholder"
    icon = LEGACY_CATEGORY_ICONS.get(row.major_product_group)
    if icon and f"{icon}.png" in placeholders:
        return f"{prefix}{icon}.png", "Category icon tile"
    hit = find_image("default", placeholders, prefix)
    if hit:
        return hit, "Default placeholder"
    return "", "No image"


def add_image_columns(df: pd.DataFrame) -> pd.DataFrame:
    photos = list_files(PRODUCT_IMAGES_DIR)
    placeholders = list_files(PLACEHOLDER_DIR)

    pairs = df[["style_code", "colour_code", "product_group", "major_product_group"]].drop_duplicates(
        ["style_code", "colour_code"]
    )
    resolved = {(r.style_code, r.colour_code): resolve_image(r, photos, placeholders) for r in pairs.itertuples(index=False)}
    keys = list(zip(df["style_code"], df["colour_code"]))
    df = df.copy()
    df["image_file"] = [resolved[k][0] for k in keys]
    df["image_source"] = [resolved[k][1] for k in keys]

    counts = pd.Series([v[1] for v in resolved.values()]).value_counts()
    print(f"images: {len(resolved):,} style-colours -> " + ", ".join(f"{n:,} {label.lower()}" for label, n in counts.items()))

    # tidy-up warnings, because a typo in a filename fails silently otherwise
    groups = sorted(df["product_group"].unique())
    have_group = [g for g in groups if find_image(slugify(g), placeholders, "")]
    print(f"images: product-group placeholders found for {len(have_group)} of {len(groups)} product groups")
    expected = {slugify(g) for g in groups} | {slugify(m) for m in df["major_product_group"].unique()}
    expected |= set(LEGACY_CATEGORY_ICONS.values()) | {"default"}
    strays = sorted(f for f in placeholders if Path(f).suffix in IMAGE_EXTENSIONS and Path(f).stem not in expected)
    if strays:
        print(f"images: {len(strays)} file(s) in categories/ don't match any product group, major group or default (typo?): {', '.join(strays)}")
    return df


def warn_if_not_on_github() -> None:
    # Power BI loads these from raw.githubusercontent.com, so a photo that
    # exists locally but isn't committed and pushed shows as a broken image
    try:
        repo = IMAGES_DIR.parents[2]
        pending = subprocess.run(
            ["git", "status", "--porcelain", "--", str(IMAGES_DIR)], cwd=repo,
            capture_output=True, text=True, timeout=20, check=True,
        ).stdout.strip().splitlines()
        unpushed = subprocess.run(
            ["git", "log", "--oneline", "@{u}..HEAD", "--", str(IMAGES_DIR)], cwd=repo,
            capture_output=True, text=True, timeout=20,
        ).stdout.strip().splitlines()
    except (OSError, subprocess.SubprocessError):
        return
    if pending:
        print(f"images: {len(pending)} image file(s) changed locally but not committed - Power BI can't see them until they're committed and pushed")
    if unpushed:
        print(f"images: {len(unpushed)} commit(s) touching images haven't been pushed yet")


def main() -> None:
    df = build()
    dupes = df["sku"].duplicated().sum()
    if dupes:
        raise ValueError(f"{dupes} duplicate SKUs — check COLOUR_CODES for a clash before writing output")

    df = add_image_columns(df)
    warn_if_not_on_github()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    n_styles = df["style_code"].nunique()
    print(f"dim_product: {len(df):,} SKU rows, {n_styles:,} styles -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()