# lib/geo/

`europe-markets.json` — country boundary polygons for the 11 markets
the regional map needs. Extracted from the `echarts-countries-js` npm
package (ISC licensed), trimmed from all 217 countries down to just the
11 that are actually markets here (1.1MB -> 54KB). Not installed as a
project dependency — only this one static file was needed, pulling in
the whole package for that would be unreasonable bloat.

Each feature carries `properties.market_code` (UK, DE, PL, IE, IT, NL,
CZ, SK, FR, LV, LT) alongside the country name, matching `dim_store`'s
`market_code` directly — no name-matching logic needed at query time.