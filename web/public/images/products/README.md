# public/images/products/

Product photography for the top products chart, one image per
style/colourway, not one per style, and not one per SKU (size doesn't
get its own image).

**Naming convention:** `{style_code}-{colour_code}.webp`. This is
exactly the SKU prefix before the size suffix (a SKU is
`{style_code}-{colour_code}-{size}`, see generator/dimensions/
build_dim_product.py), not a separately invented scheme. So the Scafell
Boots in Charcoal is `KESTREL00417-CHR.webp`.

To find which style/colourways need a photo most, look at what's ranking in
the top products chart: the query in web/lib/queries/topProducts.ts already
returns an `imagePath` per row in this format, and that's the exact filename
to drop in.

Any style/colourway without a file here falls back to a placeholder for its
product group (see `image_source` in dim_product) rather than a broken image.

The photos were generated with ChatGPT from my own prompts, so they show
invented Areta products, not real ones.