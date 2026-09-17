"""
generate_favicon.py

Builds the browser favicon set (favicon.ico, icon.png, apple-icon.png)
from mark.svg — a deliberately simplified version of the full logo
mark, not the detailed one used in branding/logo/. The real mark has
gold foil gradients and topo contour lines that just turn to mush at
16x16; this is the same two-peak silhouette and the same brand colours
(#003744 terrain, #D0AA62 summit gold) reduced to flat shapes so it
still reads as a mountain at favicon size.

One-time asset generation script, same pattern as
branding/icons/generate_icons.py — lives in branding/, not the
generator pipeline.

Usage:
    python generate_favicon.py
"""

from __future__ import annotations

from pathlib import Path

import cairosvg
from PIL import Image

HERE = Path(__file__).resolve().parent
SVG_SOURCE = HERE / "mark.svg"
WEB_APP_DIR = HERE.parents[1] / "web" / "app"


def main() -> None:
    WEB_APP_DIR.mkdir(parents=True, exist_ok=True)

    # Next.js App Router picks these up automatically by filename —
    # no metadata.icons wiring needed in layout.tsx.
    sizes_needed = {
        16: HERE / "favicon-16x16.png",
        32: HERE / "favicon-32x32.png",
        48: HERE / "favicon-48x48.png",
        180: WEB_APP_DIR / "apple-icon.png",
        512: WEB_APP_DIR / "icon.png",
    }
    for size, out_path in sizes_needed.items():
        cairosvg.svg2png(url=str(SVG_SOURCE), write_to=str(out_path), output_width=size, output_height=size)

    ico_sources = [Image.open(HERE / f"favicon-{s}x{s}.png") for s in (16, 32, 48)]
    ico_sources[1].save(
        WEB_APP_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_sources[0], ico_sources[2]],
    )

    print(f"built favicon.ico, icon.png, apple-icon.png -> {WEB_APP_DIR}")


if __name__ == "__main__":
    main()
