"""
generate_icons.py

Builds the branded icon tile set — dark terrain background, summit gold
glyph, matching the reference sheet exactly — from the real Tabler outline
SVGs already installed for the web app (web/node_modules/@tabler/icons),
not redrawn or approximated. Same source both places: the React
components in the app and these PNG tiles for Power BI are guaranteed to
match because they're literally the same icon files, not two separate
hand-matched sets that could drift apart.

One-time asset generation script, not part of the generator pipeline —
lives in branding/, not generator/.

Usage:
    python generate_icons.py
"""

from __future__ import annotations

import re
from pathlib import Path

import cairosvg

TABLER_SVG_DIR = Path(__file__).resolve().parents[2] / "web" / "node_modules" / "@tabler" / "icons" / "icons" / "outline"
OUTPUT_DIR = Path(__file__).resolve().parent / "png"

TILE_BG = "#003744"    # deep terrain
GLYPH_COLOR = "#D0AA62"  # summit gold
TILE_SIZE = 256
CORNER_RADIUS = 48
ICON_SCALE = 5  # 24x24 source -> 120x120 effective within the 256 tile

# name -> what it represents in the data model. One curated, comprehensive
# pass across the whole schema (dimensions, facts, KPIs, nav) rather than
# just the original 9 — this was the actual ask.
ICONS = {
    "layout-dashboard": "Overview",
    "chart-bar": "Sales",
    "coin": "Revenue",
    "shopping-cart": "Units sold",
    "shopping-bag": "Items per transaction",
    "receipt": "Transactions",
    "receipt-2": "Average transaction value",
    "receipt-tax": "VAT",
    "percentage": "Margin",
    "scale": "Contribution",
    "chart-pie": "Category mix",
    "trending-up": "Growth",
    "trending-down": "Decline",
    "target": "Target",
    "target-arrow": "Achievement",
    "discount": "Discount",
    "gift": "Multi-buy",
    "tag": "Promotion",
    "rotate": "Returns",
    "box": "Products",
    "package": "Stock",
    "hanger": "Apparel",
    "shoe": "Footwear",
    "category": "Product group",
    # Top-products chart fallback set (web/public/images/products/
    # categories/) — one per major_product_group, used when a specific
    # style/colourway doesn't have a sourced photo yet. Legwear and
    # Footwear deliberately reuse "hanger" and "shoe" above rather than
    # getting their own entry — same tile, same file, used both places.
    "jacket": "Outerwear",
    "hanger-2": "Midlayer",
    "shirt": "Tops",
    "sock": "Accessories",
    "backpack": "Camping & Equipment",
    "palette": "Colour",
    "ruler": "Size",
    "snowflake": "Season (AW)",
    "sun-high": "Season (SS)",
    "building-store": "Stores",
    "map-pin": "Region",
    "world": "Market",
    "device-desktop": "Digital / online",
    "users": "Customers",
    "users-group": "Staff",
    "building-bank": "Head office",
    "calendar": "Calendar",
    "currency-pound": "GBP",
    "arrows-exchange": "Currency / FX",
    "walk": "Footfall",
    "filter": "Filters",
    "database": "Data",
    "file-text": "Reports",
    # Added for the digital/stock/targets/refresh-stamp work built after
    # this set was first curated — real gaps checked against the actual
    # measure list, not guessed: device-desktop already covered Digital
    # generally, but the device SPLIT (Desktop/Mobile/Tablet) needed its
    # other two. chart-funnel deliberately shared between Conversion
    # Rate % (retail) and Digital Conversion Rate % — same underlying
    # concept (visits -> outcome), one icon not two.
    "device-mobile": "Mobile",
    "device-tablet": "Tablet",
    "eye": "Visitors",
    "click": "Sessions",
    "basket": "Average basket value",
    "chart-funnel": "Conversion rate",
    "refresh": "Last refreshed",
    "hourglass-high": "Weeks of cover",
    "stairs": "Pareto / cumulative %",
    "chart-candle": "Waterfall / P&L bridge",
    "browser": "Browser",
}


def extract_inner_svg(svg_path: Path) -> str:
    raw = svg_path.read_text()
    match = re.search(r"<svg[^>]*>(.*)</svg>", raw, re.DOTALL)
    if not match:
        raise ValueError(f"couldn't parse {svg_path}")
    inner = match.group(1)
    # drop the invisible 24x24 bounding-box path every tabler outline icon
    # starts with (stroke="none" fill="none") — pure layout scaffolding,
    # not part of the visible glyph
    inner = re.sub(r'<path stroke="none"[^/]*/>', "", inner)
    return inner.strip()


def build_tile_svg(inner_content: str) -> str:
    offset = (TILE_SIZE - 24 * ICON_SCALE) / 2
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{TILE_SIZE}" height="{TILE_SIZE}" viewBox="0 0 {TILE_SIZE} {TILE_SIZE}">
  <rect width="{TILE_SIZE}" height="{TILE_SIZE}" rx="{CORNER_RADIUS}" fill="{TILE_BG}"/>
  <g transform="translate({offset},{offset}) scale({ICON_SCALE})" stroke="currentColor" color="{GLYPH_COLOR}" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    {inner_content}
  </g>
</svg>'''


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    built = []

    for icon_name, label in ICONS.items():
        src = TABLER_SVG_DIR / f"{icon_name}.svg"
        if not src.exists():
            print(f"SKIP {icon_name} — not found in the installed Tabler set")
            continue

        inner = extract_inner_svg(src)
        tile_svg = build_tile_svg(inner)
        out_path = OUTPUT_DIR / f"{icon_name}.png"
        cairosvg.svg2png(bytestring=tile_svg.encode(), write_to=str(out_path), output_width=TILE_SIZE, output_height=TILE_SIZE)
        built.append((icon_name, label))

    print(f"\nbuilt {len(built)} of {len(ICONS)} icon tiles -> {OUTPUT_DIR}")
    missing = set(ICONS) - {n for n, _ in built}
    if missing:
        print(f"missing: {sorted(missing)}")


if __name__ == "__main__":
    main()