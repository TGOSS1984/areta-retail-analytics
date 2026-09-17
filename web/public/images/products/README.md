# public/images/products/

Product photography for the top products chart, one image per
style/colourway — not one per style, and not one per SKU (size doesn't
get its own image).

**Naming convention:** `{style_code}-{colour_code}.webp` — this is
exactly the SKU prefix before the size suffix (a SKU is
`{style_code}-{colour_code}-{size}`, see generator/dimensions/
build_dim_product.py), not a separately invented scheme. So the Scafell
Boots in Charcoal is `KESTREL00417-CHR.webp`.

To find which style_code/colour_code combos actually need an image —
i.e. what's currently ranking in the top products chart — the query in
web/lib/queries/topProducts.ts returns an `imagePath` field per row
already built in this format; that's the exact filename to drop in.

Any style/colourway without a file here falls back to a category icon
(by product_group) rather than a broken image — see
TopProductsChart.tsx once that's built.