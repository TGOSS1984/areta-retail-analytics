# lib/geo/

`europe-markets.json` — country boundary polygons for the 11 markets the
regional map needs, in real WGS84 lon/lat degrees.

I replaced this file after tracking down why the regional map was
rendering as one giant blob instead of 11 country shapes: the previous
version, extracted from the `echarts-countries-js` npm package, turned
out not to use real geographic coordinates at all — I checked the raw
values and found longitudes up to 901, which isn't a valid coordinate
in any real projection. My scatter series data (real degrees, e.g. UK
at lon -2.30) had nothing valid to line up against.

This version is extracted from [datasets/geo-countries](https://github.com/datasets/geo-countries)
(Natural Earth data, ODC-PDDL licensed), trimmed from all 258 countries
down to the 11 markets, then simplified with mapshaper (`-simplify 8%`)
to bring the file size down from ~575KB to ~46KB without losing
recognisable shape. I also had to clip France and the Netherlands down
to their mainland European extent — both carry overseas territories
(French Guiana, the Dutch Caribbean islands) in the source data, which
would otherwise have pulled the map's bounding box out to cover half
the Atlantic.

Before trusting this file I checked every feature's coordinate range
sits inside valid WGS84 bounds (-180..180 lon, -90..90 lat) and that
the combined bounding box is a sane Europe extent (lon -13.7..28.2,
lat 35.5..60.8) — the exact check that would have caught the original
bug immediately.

Each feature carries `properties.market_code` (UK, DE, PL, IE, IT, NL,
CZ, SK, FR, LV, LT) alongside the country name, matching `dim_store`'s
`market_code` directly — no name-matching logic needed at query time.