"""
build_diagrams.py

Draws the architecture pictures used in the README, in the project's own
colours and type, so they match the web app and the icon set instead of being
a screenshot of somebody else's template.

    docs/architecture/pipeline-overview.png   how the data flows, start to finish
    docs/architecture/warehouse-detail.png    the pipeline stages and what's in the warehouse
    docs/architecture/star-schema.png         the data model at a glance

The icons are the same Tabler outline icons the rest of the project uses, read
from web/node_modules (run `npm install` in web/ first). The logo comes from
branding/logo. Fonts: Montserrat if it's installed, otherwise whatever the
renderer falls back to, which still works but won't look quite the same.

Run from anywhere:
    pip install cairosvg pillow
    python docs/architecture/build_diagrams.py          (writes the PNGs)
    python docs/architecture/build_diagrams.py --svg    (writes SVGs as well)

Everything is drawn with a few helpers at the top of the file, so changing a
label or moving a box is an edit to a number, not a redraw in another tool.
"""

from __future__ import annotations

import base64
import html
import re
import sys
from pathlib import Path

import cairosvg
from PIL import ImageFont

WRITE_SVG = "--svg" in sys.argv  # off by default: the SVGs embed the logo and come out at nearly 1MB each

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ICON_DIR = ROOT / "web" / "node_modules" / "@tabler" / "icons" / "icons" / "outline"
LOGO = ROOT / "branding" / "logo" / "areta-logo-mark.png"

# brand palette (branding/theme/areta-theme.json and web/tailwind.config.ts)
ABYSS = "#00141A"
TERRAIN = "#003744"
TEAL = "#1F7486"
GOLD = "#D0AA62"
SAND = "#E8E1D6"
WHITE = "#F7F6F3"
MUTED = "#8FB8C2"
FONT = "Montserrat, 'DejaVu Sans', sans-serif"

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def text_width(text: str, size: int, weight: str = "600") -> float:
    """Rough rendered width, used to size the little pills behind arrow labels."""
    name = {"400": "Regular", "500": "Medium", "600": "SemiBold", "700": "Bold"}.get(weight, "SemiBold")
    for base in (Path.home() / ".fonts", Path("/usr/share/fonts/truetype/montserrat")):
        path = base / f"Montserrat-{name}.ttf"
        if path.exists():
            key = (str(path), size)
            if key not in _font_cache:
                _font_cache[key] = ImageFont.truetype(str(path), size)
            return _font_cache[key].getlength(text)
    return len(text) * size * 0.6


class Canvas:
    def __init__(self, width: int, height: int) -> None:
        self.w, self.h = width, height
        self.parts: list[str] = []

    def add(self, svg: str) -> None:
        self.parts.append(svg)

    # ---- shapes -----------------------------------------------------------
    def rect(self, x, y, w, h, rx=12, fill="none", stroke="none", sw=1.5, dash=None, opacity=1.0):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" fill-opacity="{opacity}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=18, weight="600", fill=WHITE, anchor="middle", opacity=1.0, italic=False):
        style = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
                 f'fill="{fill}" fill-opacity="{opacity}" text-anchor="{anchor}"{style}>{html.escape(s)}</text>')

    def lines(self, x, y, s, size=15, weight="500", fill=MUTED, anchor="middle", lh=1.35):
        for i, line in enumerate(s.split("\n")):
            self.text(x, y + i * size * lh, line, size, weight, fill, anchor)

    def icon(self, name, x, y, size=44, color=GOLD, sw=1.6):
        raw = (ICON_DIR / f"{name}.svg").read_text(encoding="utf-8")
        inner = re.search(r"<svg[^>]*>(.*)</svg>", raw, re.S).group(1)
        inner = re.sub(r'<path stroke="none"[^>]*/>', "", inner).replace("currentColor", color)
        scale = size / 24
        self.add(f'<g transform="translate({x},{y}) scale({scale})" fill="none" stroke="{color}" stroke-width="{sw}" '
                 f'stroke-linecap="round" stroke-linejoin="round">{inner}</g>')

    def image(self, path: Path, x, y, w, h):
        b64 = base64.b64encode(path.read_bytes()).decode()
        self.add(f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/png;base64,{b64}" '
                 f'preserveAspectRatio="xMidYMid meet"/>')

    # ---- composed pieces --------------------------------------------------
    def boundary(self, x, y, w, h, label, icon=None, label_color=GOLD):
        """Dashed rounded region with its name along the bottom, like a cloud-service boundary."""
        self.rect(x, y, w, h, rx=30, fill=TERRAIN, opacity=0.28)
        self.rect(x, y, w, h, rx=30, stroke=GOLD, sw=2, dash="11 9")
        ly = y + h - 20
        if icon:
            tw = text_width(label, 20, "600")
            self.icon(icon, x + w / 2 - tw / 2 - 34, ly - 22, 28, GOLD, 1.7)
        self.text(x + w / 2 + (14 if icon else 0), ly, label, 20, "600", label_color)

    def node(self, cx, cy, icon, title, sub="", highlight=False, tile=84, title_size=19, sub_size=14):
        border = GOLD if highlight else TEAL
        self.rect(cx - tile / 2, cy - tile / 2, tile, tile, rx=18, fill=TERRAIN, stroke=border, sw=2.4 if highlight else 2)
        self.icon(icon, cx - tile * 0.32, cy - tile * 0.32, tile * 0.64, GOLD if highlight else WHITE, 1.55)
        self.text(cx, cy + tile / 2 + 27, title, title_size, "700", WHITE)
        if sub:
            self.lines(cx, cy + tile / 2 + 27 + sub_size * 1.7, sub, sub_size, "500", MUTED)

    def arrow(self, pts, label=None, color=WHITE, dashed=False, label_at=0.5, label_side=None, sw=2.4):
        d = " ".join(("M" if i == 0 else "L") + f"{x},{y}" for i, (x, y) in enumerate(pts))
        dash = ' stroke-dasharray="8 7"' if dashed else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round"{dash} '
                 f'marker-end="url(#head)"/>')
        if label:
            # put the label on the longest segment
            segs = list(zip(pts[:-1], pts[1:]))
            (x1, y1), (x2, y2) = max(segs, key=lambda s: abs(s[1][0] - s[0][0]) + abs(s[1][1] - s[0][1]))
            mx, my = x1 + (x2 - x1) * label_at, y1 + (y2 - y1) * label_at
            rows = label.split("\n")
            wmax = max(text_width(r, 13, "600") for r in rows)
            hh = 13 * 1.35 * len(rows) + 8
            if label_side == "above":
                my -= hh / 2 + 6
            elif label_side == "below":
                my += hh / 2 + 6
            self.rect(mx - wmax / 2 - 8, my - hh / 2, wmax + 16, hh, rx=8, fill=ABYSS, opacity=0.92)
            for i, r in enumerate(rows):
                self.text(mx, my - hh / 2 + 13 + 4 + i * 13 * 1.35 - 1, r, 13, "600", SAND)

    def header(self, title, subtitle):
        self.image(LOGO, 34, 20, 190, 95)
        self.text(250, 66, title, 36, "700", WHITE, "start")
        self.text(250, 100, subtitle, 18, "500", SAND, "start")

    def svg(self) -> str:
        defs = (f'<defs><marker id="head" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto" '
                f'markerUnits="userSpaceOnUse"><path d="M1,1 L10,5.5 L1,10 Z" fill="{WHITE}"/></marker></defs>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">{defs}'
                f'<rect width="{self.w}" height="{self.h}" fill="{ABYSS}"/>' + "".join(self.parts) + "</svg>")

    def save(self, name: str, scale: float = 2.4) -> None:
        svg = self.svg()
        if WRITE_SVG:
            (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
        cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(OUT / f"{name}.png"), scale=scale)
        print(f"wrote {name}.png")


# --------------------------------------------------------------------------
# 1. how the data flows
# --------------------------------------------------------------------------
def pipeline_overview() -> None:
    c = Canvas(1400, 970)
    c.header("How the data flows", "One synthetic pipeline in, three ways of looking at the same numbers out")

    row1, row2, row3 = 236, 497, 760
    below, above = 124, 50  # clearance under a node's caption, and above its tile

    # generator
    c.boundary(40, 162, 310, 768, "Python generator", "brand-python")
    c.node(195, row1, "brand-github", "GitHub Actions", "weekly refresh\nMonday 06:00 UTC")
    c.node(195, row2, "brand-python", "weekly_refresh.py", "17 steps, about\n2 minutes", highlight=True)
    c.node(195, row3, "file-settings", "Config", "brands, markets,\nseasonality, targets")
    c.arrow([(195, row1 + below), (195, row2 - above)], "on a schedule")
    c.arrow([(195, row3 - above), (195, row2 + below)], "reads")

    # warehouse
    c.boundary(400, 162, 580, 768, "Warehouse  (data/)", "database")
    c.node(490, row2, "file-spreadsheet", "Raw", "deliberately messy\nsales file")
    c.node(690, row2, "settings-automation", "Clean", "duplicates, casing,\nblank discounts")
    c.node(890, row2, "database", "Warehouse", "star schema,\nParquet files", highlight=True)
    c.node(890, row1, "shield-check", "Audit", "78 checks, results\nwritten as 2 tables")
    c.node(890, row3, "package-export", "Web exports", "pre-aggregated\nParquet for the app")
    c.arrow([(350, row2), (438, row2)], "writes")
    c.arrow([(546, row2), (634, row2)], "3.9M lines")
    c.arrow([(746, row2), (834, row2)], "cleaned")
    c.arrow([(890, row2 - above), (890, row1 + below)])
    c.arrow([(890, row2 + below), (890, row3 - above)])
    c.lines(560, row1 - 14, "Every table is a Parquet file,\nso there's no database server\nanywhere in the project.", 15, "500", SAND)
    c.lines(560, row3 - 14, "Raw and staging stay out of git.\nOnly the warehouse and the\nweb exports are committed.", 15, "500", SAND)

    # consumers, one row each so the arrows run straight across
    c.boundary(1060, 162, 310, 242, "Power BI", "chart-bar")
    c.node(1215, row1, "cube", "Semantic model", "367 measures", tile=76, title_size=17, sub_size=13)
    c.boundary(1060, 425, 310, 242, "SQL suite", "terminal-2")
    c.node(1215, row2, "database-search", "DuckDB", "147 queries + exercises", tile=76, title_size=17, sub_size=13)
    c.boundary(1060, 688, 310, 242, "Web app", "brand-nextjs")
    c.node(1215, row3, "layout-dashboard", "Next.js dashboard", "DuckDB-wasm, ECharts", tile=76, title_size=17, sub_size=13)

    # the warehouse feeds Power BI and SQL directly (one trunk, two branches)
    c.add(f'<path d="M946,{row2} L1010,{row2} L1010,{row1}" fill="none" stroke="{WHITE}" stroke-width="2.4" stroke-linejoin="round"/>')
    c.arrow([(1010, row1), (1168, row1)], "Parquet import", label_side="above")
    c.arrow([(1010, row2), (1168, row2)], "read_parquet", label_side="above")
    # the app reads its own exports
    c.arrow([(946, row3), (1168, row3)], "fetched in the browser", label_side="above")

    c.text(700, 958, "Everything upstream of the report is one Python pipeline, so the numbers can't drift between the three.",
           15, "500", SAND, italic=True)
    c.save("pipeline-overview")



# --------------------------------------------------------------------------
# 2. pipeline stages and the tables they produce
# --------------------------------------------------------------------------
def chip(c: Canvas, x, y, w, icon, name, meta, accent=TEAL, h=52):
    c.rect(x, y, w, h, rx=12, fill=TERRAIN, stroke=accent, sw=1.8)
    c.icon(icon, x + 12, y + h / 2 - 14, 28, GOLD, 1.6)
    c.text(x + 50, y + 22, name, 15, "700", WHITE, "start")
    c.text(x + 50, y + 40, meta, 12, "500", MUTED, "start")


def warehouse_detail() -> None:
    c = Canvas(1400, 1010)
    c.header("What's in the warehouse", "The pipeline stages, the tables they produce, and what reads them")

    # left: the steps
    c.boundary(40, 162, 380, 810, "Pipeline steps  (generator/)", "brand-python")
    steps = [
        ("calendar", "Dimensions", "date, period, store, product,\npromo, currency", False),
        ("chart-bar", "Facts, first pass", "sales, footfall, stock, targets,\nfinance, digital", False),
        ("settings-automation", "Clean", "11,810 duplicate lines dropped,\n118,458 store IDs fixed", True),
        ("database", "Warehouse tables", "Parquet, star schema", True),
        ("shield-check", "Audit", "78 checks, results as 2 tables", False),
        ("package-export", "Web exports", "pre-aggregated for the app", False),
    ]
    ys = [232, 352, 472, 592, 712, 832]
    for (icon, title, sub, hi), y in zip(steps, ys):
        c.rect(70, y - 42, 320, 92, rx=16, fill=TERRAIN, stroke=GOLD if hi else TEAL, sw=2.2 if hi else 1.8)
        c.icon(icon, 86, y - 22, 44, GOLD if hi else WHITE, 1.6)
        c.text(146, y - 8, title, 18, "700", WHITE, "start")
        c.lines(146, y + 14, sub, 13, "500", MUTED, "start", lh=1.3)
    for a, b in zip(ys[:-1], ys[1:]):
        c.arrow([(230, a + 54), (230, b - 46)], sw=2.2)

    # middle: the warehouse
    c.boundary(470, 162, 570, 810, "data/warehouse", "database")
    c.text(500, 214, "DIMENSIONS", 14, "700", GOLD, "start")
    c.text(790, 214, "FACTS", 14, "700", GOLD, "start")
    dims = [("calendar", "dim_date", "1,456 days"), ("calendar-stats", "dim_period", "48 business periods"),
            ("building-store", "dim_store", "361 stores"), ("shirt", "dim_product", "12,151 SKUs"),
            ("tag", "dim_promo", "35 promotions"), ("currency-pound", "dim_currency", "4 currencies"),
            ("arrows-exchange", "fx_rate_monthly", "192 monthly rates")]
    facts = [("shopping-cart", "fact_sales", "about 3.9M invoice lines"), ("walk", "fact_footfall", "about 454k store-days"),
             ("building-warehouse", "fact_stock_snapshot", "about 6.8M weekly rows"), ("target", "fact_targets", "17,328 store-periods"),
             ("calculator", "fact_store_finance", "15,050 store-period P&Ls"), ("device-desktop", "fact_digital_sales", "about 43k market-days"),
             ("browser", "fact_digital_traffic", "about 214k rows"), ("target-arrow", "fact_digital_targets", "528 market-periods")]
    for i, (ic, n, m) in enumerate(dims):
        chip(c, 500, 232 + i * 64, 250, ic, n, m)
    for i, (ic, n, m) in enumerate(facts):
        chip(c, 780, 232 + i * 64, 235, ic, n, m, accent=GOLD if n == "fact_sales" else TEAL)
    c.rect(500, 756, 515, 2, rx=1, fill=GOLD, opacity=0.4)
    c.text(500, 790, "AUDIT AND EXPORTS", 14, "700", GOLD, "start")
    chip(c, 500, 804, 250, "shield-check", "dq_check_results", "78 checks")
    chip(c, 500, 868, 250, "table-options", "dq_table_profile", "15 tables profiled")
    chip(c, 780, 804, 235, "package-export", "data/exports", "5 files for the web app")
    c.lines(780, 886, "Only the warehouse and exports are\ncommitted. Raw and staging aren't.", 13, "500", SAND, "start")

    c.arrow([(390, 592), (470, 592)], "load", sw=2.4)

    # right: consumers
    c.boundary(1090, 162, 280, 250, "Power BI", "chart-bar")
    c.node(1230, 262, "cube", "Semantic model", "24 tables, 367 measures", tile=72, title_size=17, sub_size=13)
    c.boundary(1090, 432, 280, 250, "SQL suite", "terminal-2")
    c.node(1230, 532, "database-search", "DuckDB", "147 queries", tile=72, title_size=17, sub_size=13)
    c.boundary(1090, 702, 280, 270, "Web app", "brand-nextjs")
    c.node(1230, 802, "layout-dashboard", "DuckDB-wasm", "reads the exports", tile=72, title_size=17, sub_size=13)
    c.arrow([(1040, 262), (1170, 262)], "Parquet\nimport", label_side="above")
    c.arrow([(1040, 532), (1170, 532)], "read_parquet", label_side="above")
    c.arrow([(1040, 802), (1170, 802)], "fetch", label_side="above")
    c.save("warehouse-detail")


# --------------------------------------------------------------------------
# 3. the data model at a glance
# --------------------------------------------------------------------------
def mini(c: Canvas, x, y, icon, active=True, size=30):
    """A small dimension icon; dashed outline when the relationship is left inactive and handled in DAX."""
    if active:
        c.rect(x, y, size, size, rx=8, fill=TERRAIN, stroke=GOLD, sw=1.6)
    else:
        c.rect(x, y, size, size, rx=8, fill="none", stroke=MUTED, sw=1.6, dash="4 3")
    c.icon(icon, x + size * 0.18, y + size * 0.18, size * 0.64, GOLD if active else MUTED, 1.7)


def star_schema() -> None:
    c = Canvas(1400, 1010)
    c.header("The data model at a glance", "Eight dimensions, nine fact tables, one date table that everything shares")

    # dimensions
    c.boundary(40, 150, 1320, 262, "Dimensions", "topology-star-3")
    dim_cards = [
        ("calendar", "dim_date", "full_date, business year,\nperiod, week, day", "1,456 rows"),
        ("calendar-stats", "dim_period", "period_key, label,\nstart and end dates", "48 rows"),
        ("building-store", "dim_store", "channel, store type,\nmarket, region", "361 rows"),
        ("shirt", "dim_product", "SKU, style, colour,\nbrand, product group", "12,151 rows"),
        ("tag", "dim_promo", "promo type, dates,\ndiscount %", "35 rows"),
        ("currency-pound", "dim_currency", "currency code,\nsymbol", "4 rows"),
        ("world", "dim_market", "market code, name,\ncurrency (Power Query)", "11 rows"),
        ("browser", "dim_browser", "browser, logo\n(small lookup)", "5 rows"),
    ]
    x0, w, gap = 60, 148, 16
    for i, (ic, n, k, r) in enumerate(dim_cards):
        x = x0 + i * (w + gap)
        c.rect(x, 172, w, 190, rx=16, fill=TERRAIN, stroke=GOLD if n == "dim_date" else TEAL, sw=2)
        c.icon(ic, x + w / 2 - 20, 186, 40, GOLD, 1.6)
        c.text(x + w / 2, 250, n, 15, "700", WHITE)
        c.lines(x + w / 2, 272, k, 12, "500", MUTED, lh=1.35)
        c.text(x + w / 2, 340, r, 12, "600", SAND)

    # facts
    c.boundary(40, 432, 1320, 480, "Facts", "table")
    facts = [
        ("shopping-cart", "fact_sales", "one row per invoice line", "about 3.9M rows",
         [("calendar", True), ("building-store", True), ("shirt", True), ("tag", True), ("currency-pound", True)]),
        ("walk", "fact_footfall", "one row per store per day", "about 454k rows",
         [("calendar", True), ("building-store", True)]),
        ("building-warehouse", "fact_stock_snapshot", "store, style, colour, week", "about 6.8M rows",
         [("calendar", True), ("building-store", True)]),
        ("target", "fact_targets", "one row per store per period", "17,328 rows",
         [("calendar-stats", True), ("building-store", True), ("calendar", False)]),
        ("calculator", "fact_store_finance", "one row per store per period", "15,050 rows",
         [("calendar-stats", True), ("building-store", True), ("calendar", False)]),
        ("device-desktop", "fact_digital_sales", "market, device, day", "about 43k rows",
         [("calendar", True), ("world", True)]),
        ("browser", "fact_digital_traffic", "market, device, browser, day", "about 214k rows",
         [("calendar", True), ("browser", True), ("world", False)]),
        ("target-arrow", "fact_digital_targets", "one row per market per period", "528 rows",
         [("calendar-stats", True), ("world", False), ("calendar", False)]),
        ("arrows-exchange", "fx_rate_monthly", "currency per month", "192 rows",
         [("currency-pound", True)]),
    ]
    cw, ch, gx, gy = 246, 190, 14, 22
    for i, (ic, n, grain, rows, chips) in enumerate(facts):
        col, row = i % 5, i // 5
        x, y = 60 + col * (cw + gx), 456 + row * (ch + gy)
        c.rect(x, y, cw, ch, rx=16, fill=TERRAIN, stroke=GOLD if n == "fact_sales" else TEAL, sw=2.2 if n == "fact_sales" else 1.8)
        c.icon(ic, x + 16, y + 16, 38, GOLD, 1.6)
        c.text(x + 66, y + 34, n, 16, "700", WHITE, "start")
        c.text(x + 66, y + 54, rows, 12, "600", SAND, "start")
        c.text(x + 16, y + 92, grain, 13, "500", MUTED, "start")
        c.text(x + 16, y + 124, "JOINS TO", 11, "700", GOLD, "start")
        for j, (dic, active) in enumerate(chips):
            mini(c, x + 16 + j * 40, y + 134, dic, active)
    # legend in the spare slot
    lx, ly = 60 + 4 * (cw + gx), 456 + (ch + gy)
    c.rect(lx, ly, cw, ch, rx=16, fill="none", stroke=GOLD, sw=1.4, dash="6 5")
    c.text(lx + 16, ly + 34, "READING THE CARDS", 12, "700", GOLD, "start")
    mini(c, lx + 16, ly + 50, "calendar", True)
    c.lines(lx + 58, ly + 62, "active relationship", 13, "500", SAND, "start")
    mini(c, lx + 16, ly + 92, "calendar", False)
    c.lines(lx + 58, ly + 100, "no relationship, measures\nuse TREATAS instead", 13, "500", SAND, "start", lh=1.25)
    c.lines(lx + 16, ly + 152, "Everything reaches dim_date\nthrough one shared calendar.", 12, "500", MUTED, "start", lh=1.3)

    c.text(700, 990, "Three relationships are inactive on purpose. Leaving them on brought back the cyclic-reference error, so the measures use TREATAS.",
           14, "500", SAND, italic=True)
    c.save("star-schema")


if __name__ == "__main__":
    pipeline_overview()
    warehouse_detail()
    star_schema()