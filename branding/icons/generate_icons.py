"""
generate_icons.py

Builds the branded icon tile sets from the real Tabler outline SVGs
already installed for the web app (web/node_modules/@tabler/icons), not
redrawn or approximated. Same source both places: the React components in
the app and these PNG tiles for Power BI are guaranteed to match because
they're literally the same icon files, not separate hand-matched sets that
could drift apart.

Four variations of the same set come out of one run, all from the same
ICONS list and the same tile geometry, so they're drop-in swaps for each
other in Power BI (change the image source and nothing shifts or resizes):

    png/                     summit gold glyph on a deep terrain tile (the original)
    png-teal-on-white/       deep terrain teal glyph on a white tile
    png-gold-transparent/    summit gold glyph, no tile, transparent background
    png-teal-transparent/    deep terrain teal glyph, no tile, transparent background

One-time asset generation script, not part of the generator pipeline —
lives in branding/, not generator/.

Usage:
    python generate_icons.py
"""

from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image  # already installed as a cairosvg dependency

TABLER_SVG_DIR = Path(__file__).resolve().parents[2] / "web" / "node_modules" / "@tabler" / "icons" / "icons" / "outline"
ICONS_DIR = Path(__file__).resolve().parent

# The two brand colours the sets are built from (both straight from
# theme/areta-theme.json, so a palette change is one edit here).
DEEP_TERRAIN = "#003744"  # the darker teal
SUMMIT_GOLD = "#D0AA62"
WHITE = "#FFFFFF"

# One entry per variation. bg=None means no tile at all — the glyph sits on
# a transparent canvas. Everything else (canvas size, glyph scale, stroke)
# is shared below, on purpose, so the sets line up exactly.
STYLES = [
    {"folder": "png",                  "bg": DEEP_TERRAIN, "glyph": SUMMIT_GOLD},
    {"folder": "png-teal-on-white",    "bg": WHITE,        "glyph": DEEP_TERRAIN},
    {"folder": "png-gold-transparent", "bg": None,         "glyph": SUMMIT_GOLD},
    {"folder": "png-teal-transparent", "bg": None,         "glyph": DEEP_TERRAIN},
]

TILE_SIZE = 256
CORNER_RADIUS = 48  # applies to the white tile too; set to 0 for a square white background
ICON_SCALE = 5  # 24x24 source -> 120x120 effective within the 256 canvas

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
    # ---- Added for report page navigation, plus the gaps I found going
    # back through the actual measure list and the Power BI page designs.
    # Every name here was checked against the installed Tabler set first.
    #
    # Page navigation / buttons. "home" is the landing page button; the rest
    # are the usual bits a report needs (back, info, clear filters, and so on).
    "home": "Home",
    "arrow-left": "Back",
    "arrow-right": "Forward / next page",
    "info-circle": "Info / about this page",
    "help-circle": "Help",
    "adjustments-horizontal": "Filter panel / options",
    "filter-off": "Clear filters",
    "x": "Close",
    "menu-2": "Menu",
    "search": "Search",
    "download": "Export / download",
    "bookmark": "Bookmarks",
    "settings": "Settings",
    "external-link": "Open link",
    "layout-sidebar-left-collapse": "Hide slicer panel",
    "layout-sidebar-left-expand": "Show slicer panel",
    # Finance / P&L cost lines (rent, staff, utilities, marketing and head
    # office are all real lines in fact_store_finance; staff and head office
    # already had users-group and building-bank).
    "calculator": "Finance",
    "moneybag": "Gross profit",
    "key": "Rent",
    "bolt": "Utilities",
    "speakerphone": "Marketing",
    # Stock / channels / currency
    "building-warehouse": "Stock (page) / warehouse",
    "truck-delivery": "Online orders / fulfilment",
    "building-community": "Concession",
    "currency-euro": "EUR",
    # Chart types, for chart-type buttons or visual headers
    "chart-line": "Trend",
    "chart-area": "Cumulative trend",
    "chart-treemap": "Treemap",
    "chart-donut": "Share / split",
    "chart-dots": "Scatter",
    "table": "Table view",
    # Status and time
    "alert-triangle": "Alert / warning",
    "circle-check": "On target",
    "clock": "Time",
    "calendar-week": "Week",
    "calendar-event": "Promo event / key date",
    # Brand, ranking and portfolio links
    "mountain": "Areta brand",
    "award": "Brand",
    "trophy": "Top performers",
    "star": "Best sellers",
    "brand-github": "GitHub repo",
    "brand-linkedin": "LinkedIn",
}

# Which icon goes with which report page, so I'm not guessing at the nav
# buttons later. Most of these already existed above, they just weren't
# labelled as page icons. Box and package look almost identical at nav-button
# size, so Stock uses the warehouse instead, and Categories uses the pie so it
# doesn't get confused with the Overview grid.
PAGE_ICONS = {
    "Home": "home",
    "Overview": "layout-dashboard",
    "Sales": "chart-bar",
    "Products": "box",
    "Categories": "chart-pie",
    "Retail": "building-store",
    "Promotional": "tag",
    "Digital": "device-desktop",
    "Finance": "calculator",
    "Stock": "building-warehouse",
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


def flatten_colour(png_bytes: bytes, hex_colour: str) -> bytes:
    # The transparent set is a single-colour glyph, so the whole shape lives in
    # the alpha channel. I force RGB to the exact brand colour and keep only the
    # alpha, which stops the anti-aliased edge pixels picking up faint off-colour
    # fringing from the renderer's rounding.
    alpha = Image.open(BytesIO(png_bytes)).convert("RGBA").getchannel("A")
    out = Image.new("RGBA", alpha.size, hex_colour)
    out.putalpha(alpha)
    buf = BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def build_tile_svg(inner_content: str, bg: str | None, glyph: str) -> str:
    offset = (TILE_SIZE - 24 * ICON_SCALE) / 2
    # transparent variant just skips the tile rect
    tile = f'<rect width="{TILE_SIZE}" height="{TILE_SIZE}" rx="{CORNER_RADIUS}" fill="{bg}"/>\n  ' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{TILE_SIZE}" height="{TILE_SIZE}" viewBox="0 0 {TILE_SIZE} {TILE_SIZE}">
  {tile}<g transform="translate({offset},{offset}) scale({ICON_SCALE})" stroke="currentColor" color="{glyph}" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    {inner_content}
  </g>
</svg>'''


def main() -> None:
    missing: set[str] = set(ICONS)

    for style in STYLES:
        out_dir = ICONS_DIR / style["folder"]
        out_dir.mkdir(parents=True, exist_ok=True)
        built = []

        for icon_name, label in ICONS.items():
            src = TABLER_SVG_DIR / f"{icon_name}.svg"
            if not src.exists():
                print(f"SKIP {icon_name} — not found in the installed Tabler set")
                continue

            inner = extract_inner_svg(src)
            tile_svg = build_tile_svg(inner, style["bg"], style["glyph"])
            out_path = out_dir / f"{icon_name}.png"
            png = cairosvg.svg2png(bytestring=tile_svg.encode(), output_width=TILE_SIZE, output_height=TILE_SIZE)
            if style["bg"] is None:
                png = flatten_colour(png, style["glyph"])
            out_path.write_bytes(png)
            built.append((icon_name, label))

        missing &= set(ICONS) - {n for n, _ in built}
        print(f"built {len(built)} of {len(ICONS)} icon tiles -> {out_dir}")

    if missing:
        print(f"missing: {sorted(missing)}")

    # every report page should have an icon that actually got built
    unbuilt = {page: icon for page, icon in PAGE_ICONS.items() if icon in missing or icon not in ICONS}
    if unbuilt:
        print(f"page icons with no built file: {unbuilt}")
    else:
        print(f"all {len(PAGE_ICONS)} report pages have an icon:")
        for page, icon in PAGE_ICONS.items():
            print(f"  {page:<12} -> {icon}.png")


if __name__ == "__main__":
    main()