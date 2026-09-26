# web

The browser front end for Areta Retail Analytics. Next.js (App Router) and TypeScript, Tailwind, ECharts, Tabler icons and DuckDB-wasm. There's no API and no server: the browser downloads Parquet files and runs SQL on them itself, so it deploys as a static site.

## Running it

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

`predev` and `prebuild` run `scripts/sync-data.mjs`, which copies `data/exports/*.parquet` into `public/data/`. If that folder is empty, run `python generator/export_web_data.py` (or the full `generator/weekly_refresh.py`) first.

## How it's put together

**Data.** `generator/export_web_data.py` writes small pre-aggregated exports: daily sales by store, daily sales by style and colour, daily footfall with basket counts, targets and store finance by period, and the date, store and product dimensions. They stay a star schema and the SQL joins them, the same way Power BI does. `lib/duckdb.ts` registers a table the first time a query mentions it, so a page only downloads what it uses.

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

**Charts.** `components/charts/base/EChart.tsx` measures its own width and passes it to the chart's option builder, so a chart can change what it shows when it's narrow: the waterfall turns horizontal, the donut moves its legend underneath, heatmaps drop their cell labels. The calendar heatmap needs about 14px a week to be readable, so on a phone it scrolls sideways instead of shrinking. The map only pans and zooms with a mouse, so a finger can still scroll the page past it.

## Pages

| Page | Status | Visuals |
|---|---|---|
| Overview | Built | KPI cards with sparklines, sales trend, channel mix, Europe map with UK drill-down, top products, sales and margin by month, category mix |
| Sales | Built | Weekly filled line vs last year, calendar heatmap, market waterfall, sales vs phased target by period |
| Stores | Built | Visitor-to-basket funnel, footfall vs conversion scatter, sortable league table, weekday x period footfall heatmap |
| Products, Categories, Margins | Next | Pareto, bubble scatter, treemap, matrix heatmap, sunburst, Sankey, P&L waterfall, box plot |
| Digital, Customers, Forecasting, Reports, Data | After that | Stacked area, device heatmap, basket histogram, projection with a range band, gauge, data quality tables |

## Testing

I can't open a browser where I build this, so everything is checked another way before it ships. `tsc` and `next build` have to pass. Every query function is also run in Node against a real DuckDB and the real export files, across several filter combinations: year to date, a single market, a finished year, the first year (which has no last year) and a period range. The breakdowns have to sum to the KPI totals to the pound, which they do. What still needs a real look is how it renders, especially at phone and tablet widths.