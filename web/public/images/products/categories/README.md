# public/images/products/categories/

Placeholder images, shown when a style/colourway doesn't have a photo of its own in `../`. Power BI can't tell whether a URL exists, so `generator/dimensions/build_dim_product.py` looks at this folder and `../` when it builds `dim_product`, and writes the winning file into an `image_file` column. Power BI's `image_url` is just that path on top of the GitHub raw URL.

## Which image a product gets

The first file that exists wins:

1. **Its own photo:** `../{style_code}-{colour_code}.webp`
2. **A product group placeholder:** `{product-group-slug}.webp` (or `.png`, `.jpg`) in this folder
3. **A major product group placeholder:** `{major-group-slug}.webp` in this folder
4. **The original icon tile** for the major group (the `.png` files in the table below)
5. **A general fallback:** `default.webp` in this folder

So I can start with seven images at major group level, then add product group ones wherever a category deserves its own look. Nothing breaks in between.

## Naming

Lower case, exactly as below. GitHub's raw URLs are case sensitive, so `Outerwear.webp` would be ignored (the build script flags files like that). The slug is the group name lower-cased, `&` written as `and`, and anything else that isn't a letter or number turned into `-`.

Major product groups:

| Major product group | Slug | Original icon tile |
|---|---|---|
| Accessories | `accessories` | `sock.png` |
| Camping & Equipment | `camping-and-equipment` | `backpack.png` |
| Footwear | `footwear` | `shoe.png` |
| Legwear | `legwear` | `hanger.png` |
| Midlayer | `midlayer` | `hanger-2.png` |
| Outerwear | `outerwear` | `jacket.png` |
| Tops | `tops` | `shirt.png` |

Product groups (some names sit in more than one major group, for example Socks, Softshell and Gilets & Bodywarmers, and one file covers both):

| Major product group | Product group | Slug |
|---|---|---|
| Accessories | Accessory Sets | `accessory-sets` |
| Accessories | Gloves | `gloves` |
| Accessories | Hats | `hats` |
| Accessories | Scarves | `scarves` |
| Accessories | Socks | `socks` |
| Camping & Equipment | Camping Accessories | `camping-accessories` |
| Camping & Equipment | Rucksacks | `rucksacks` |
| Camping & Equipment | Sleeping Bags | `sleeping-bags` |
| Camping & Equipment | Tents | `tents` |
| Camping & Equipment | Walking Poles | `walking-poles` |
| Footwear | Boots | `boots` |
| Footwear | Sandals | `sandals` |
| Footwear | Shoes | `shoes` |
| Footwear | Socks | `socks` |
| Footwear | Wellingtons | `wellingtons` |
| Legwear | Leggings/Tights | `leggings-tights` |
| Legwear | Overtrousers | `overtrousers` |
| Legwear | Shorts | `shorts` |
| Legwear | Skirts | `skirts` |
| Legwear | Trousers | `trousers` |
| Midlayer | Base Layer | `base-layer` |
| Midlayer | Fleece | `fleece` |
| Midlayer | Gilets & Bodywarmers | `gilets-and-bodywarmers` |
| Midlayer | Knitwear, Hoodies & Sweatshirts | `knitwear-hoodies-and-sweatshirts` |
| Midlayer | Softshell | `softshell` |
| Outerwear | 3 in 1 | `3-in-1` |
| Outerwear | Baffled/Quilted | `baffled-quilted` |
| Outerwear | Gilets & Bodywarmers | `gilets-and-bodywarmers` |
| Outerwear | Non-Waterproof Jacket | `non-waterproof-jacket` |
| Outerwear | Softshell | `softshell` |
| Outerwear | Waterproof Insulated Jacket | `waterproof-insulated-jacket` |
| Outerwear | Waterproof Shell | `waterproof-shell` |
| Tops | Polo Shirts | `polo-shirts` |
| Tops | Shirts | `shirts` |
| Tops | T-Shirts | `t-shirts` |
| Tops | Vests | `vests` |

## Adding or changing images

1. Drop the files in, named as above.
2. Run `python generator/dimensions/build_dim_product.py`. It prints how many style/colourways landed on each level, and warns about files that don't match anything and about images that aren't committed and pushed yet.
3. Commit and push. Power BI reads from GitHub, not from disk.
4. Refresh Power BI.

The web app's top products chart still uses the original icon tiles by major group on its own, in the browser.