# web

The browser front end for Areta Retail Analytics. Next.js (App Router) and TypeScript, Tailwind, ECharts, Tabler icons and DuckDB-wasm. There's no API and no server: the browser downloads Parquet files and runs SQL on them itself, so it deploys as a static site.

## Running it

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

`predev` and `prebuild` run `scripts/sync-data.mjs`, which copies `data/exports/*.parquet` into `public/data/`. If that folder is empty, run `python generator/export_web_data.py` (or the full `generator/weekly_refresh.py`) first.

## Deploying

It's hosted on Vercel: [live web app](https://areta-retail-analytics.vercel.app/) (link to follow). Every page is prerendered and all the data work happens in the browser, so it's a static site with nothing to configure beyond where the app lives in the repo. To set it up from scratch:

1. Sign in at [vercel.com](https://vercel.com) with GitHub, choose **Add New → Project**, and import `areta-retail-analytics`.
2. Set **Root Directory** to `web`. Vercel spots Next.js and fills in the build settings itself.
3. Leave the option to include files outside the root directory switched on (it is by default). The `prebuild` step copies `data/exports` from the repo root into `public/data`, so the build needs to see that folder.
4. Deploy.

After that, every push to `main` redeploys it. That includes the weekly GitHub Actions data refresh, so the live numbers move on without anyone touching the site. `web/public/data` is git-ignored on purpose: the Parquet files are only ever copied in at build time, from the one copy in `data/exports`.

## How it's put together

**Data.** `generator/export_web_data.py` writes small pre-aggregated exports: daily sales by store, daily sales by style and colour, daily sales by market, channel, product hierarchy and discount band with returns alongside (the "mix" export), baskets by size, daily footfall with basket counts, the three digital facts, targets and store finance by period, the data quality audit's two tables, and the date, store and product dimensions. They stay a star schema and the SQL joins them, the same way Power BI does. `lib/duckdb.ts` registers a table the first time a query mentions it, so a page only downloads what it uses.

**Filters.** `lib/filters/` holds the year, period-range and market filters every page shares. They're kept in the URL. `resolveFilters` turns the URL into a selection the data can answer: it defaults to year to date, pulls anything out of range back in, and works out this year's dates and the matching days last year (always 364 days earlier, so the same weekday in the same business week). `lib/filters/sql.ts` turns that into the SQL fragments every query uses, so "this year" and "last year" mean the same thing on every chart. The market code ends up inside SQL, so it's checked against a strict pattern and the real market list first.

**Queries and hooks.** Each page has a query file in `lib/queries/` that takes the resolved filters. `useFilteredData(fetcher)` runs one and re-runs it when the filters change.

**Layout.** Three layouts, not one that reflows by accident:

| Width | Navigation | Page |
|---|---|---|
| Phone, under 768px | Top bar and slide-out menu | One column, KPIs two across, every card its own height |
| Tablet, 768 to 1279px | 72px icon rail | Two columns, the page scrolls |
| Desktop, 1280px and up | Full sidebar | Twelve columns; on screens at least 820px tall the grid fits the viewport exactly |

The fit-to-screen layout is its own Tailwind breakpoint (`fit:` in `tailwind.config.ts`) because it needs height as well as width. A wide but short window scrolls instead of squashing every chart.

**Page banner.** Every page opens the same way as the Overview: `PageHeader` draws the mountain banner with the page's question and the filters, and the page's KPI strip goes inside it as children, so the KPIs sit over the image in the same frosted cards the Overview uses.

**Customers without customer data.** There are no customer records, so the Customers page is about shopping behaviour: one invoice is one basket, one trip. That's real analysis on the invoice lines rather than invented shoppers.

**The forecast.** Every day still to come is last year's same day times this year's growth so far; the range uses the 10th and 90th percentile of this year's weekly growth instead. It's simple on purpose, so anyone can check it, and the page says how it works. It always covers the whole business year and follows the market filter. Its sales and target to date match the Sales page to the pound, because both phase targets the same way.

**Market filter.** Everything follows it except the Products page and the Overview's top products card, which read the style-colour export. That's kept at date x style x colour, with no store, so it stays a few megabytes. Both say "showing all markets" when a market is selected rather than quietly showing the wrong thing.

**Charts.** `components/charts/base/EChart.tsx` measures its own width and passes it to the chart's option builder, so a chart can change what it shows when it's narrow: the waterfall turns horizontal, the donut moves its legend underneath, heatmaps drop their cell labels. The calendar heatmap needs about 14px a week to be readable, so on a phone it scrolls sideways instead of shrinking. The map only pans and zooms with a mouse, so a finger can still scroll the page past it.

## Pages

| Page | Status | Visuals |
|---|---|---|
| Overview | Built | KPI cards with sparklines, sales trend, channel mix, Europe map with UK drill-down, top products, sales and margin by month, category mix |
| Sales | Built | Weekly filled line vs last year, calendar heatmap, market waterfall, sales vs phased target by period |
| Stores | Built | Visitor-to-basket funnel, footfall vs conversion scatter, sortable league table, weekday x period footfall heatmap |
| Products | Built | Style Pareto with the 80% line, brand and category treemap, price vs volume bubble scatter (log scale), best and slowest sellers with photos and sparklines |
| Categories | Built | Growth heatmap (major group x market), range sunburst, channel-to-category Sankey, risers and fallers bars |
| Margins | Built | Store P&L waterfall, sales and margin by discount band, box plot of store contribution by type, product group x period margin matrix |
| Digital | Built | Stacked area of sessions by device, sessions and conversion by device (bar + line), market x device conversion heatmap, browser share |
| Customers | Built | Basket size histogram with share of sales, spend per basket dot plot (market x channel), weekly multi-item share, return rate radial bars |
| Forecasting | Built | Cumulative actual and projection with a range band against target, target gauge, period-by-period projection table |
| Data | Built | Quality score KPIs, checks by category, reconciliations side by side, table freshness, every check with what it tests |
| Reports | Built | An index of every page, its question and its visuals, from the nav config |

## Testing

I can't open a browser where I build this, so everything is checked another way before it ships. `tsc` and `next build` have to pass. Every query function is also run in Node against a real DuckDB and the real export files, across several filter combinations: year to date, a single market, a finished year, the first year (which has no last year) and a period range. The breakdowns have to sum to the KPI totals to the pound, which they do. What still needs a real look is how it renders, especially at phone and tablet widths.