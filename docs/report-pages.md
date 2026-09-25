# Report pages

This is my build sheet for the ten report pages. Every field and measure named here exists in the model as of the 395-measure build, and I checked the relationship paths behind each visual so nothing here quietly returns the wrong number.

## Page anatomy

Every page is 1920 x 1080 and starts from the same shell: the 211px left rail (logo, page navigator, slicer stack), the 84px header banner with the page title, the `Report Last Refreshed` card and the `business_year` slicer.

I lay the content out on one grid so the pages line up when you flick between them. The content area runs from x = 227 to 1901 and y = 94 to 1070.

| Slot | y | h | Notes |
|---|---|---|---|
| KPI row | 94 | 162 | Five cards, 324 wide, at x = 227, 570, 903, 1241, 1577. Same card + icon + sparkline template as Overview. |
| Row A | 268 | 400 | Main visuals |
| Row B | 680 | 390 | Supporting visuals |

| Width pattern | Widths (x positions) |
|---|---|
| Thirds | 550 each (227, 789, 1351) |
| Two-thirds + third | 1107 (227) + 555 (1346) |
| Halves | 831 each (227, 1070) |
| 40 / 60 | 666 (227) + 996 (905) |
| Full | 1674 (227) |

All gaps are 12px.

### KPI cards

Each card shows the headline measure with its YoY or Target Combo as the reference label. The sparkline sits on `business_week_number`, same as Overview. The Trend Colour conditional formatting is still manual per card: Reference label, then Font colour, then Field value, then the matching Trend Colour measure.

### Slicers

The rail slicers aren't the same on every page. A slicer only filters what it has a relationship path to, and several facts don't reach `dim_product` or `dim_store`.

| Page | Keep | Remove / replace |
|---|---|---|
| Sales, Products, Categories, Retail, Promo | week, month, product_group, major_product_group, channel | none |
| Stock | product_group, major_product_group, channel | week and month (stock is a weekly closing balance, a month slicer mid-period reads oddly) |
| Digital | week, month | product and channel slicers do nothing to digital facts. Replace with `dim_market[market_name]`. |
| Finance | none of the date ones | Finance and targets are period grain. Replace with `dim_store[store_type]` and `dim_store[market_name]`. |
| Data Quality | nothing | The DQ tables have no relationships, so no slicer does anything. See that page. |

### KPI icons

The icons are the Tabler set in `branding/icons/`, in the same colour variant the Overview cards use. One metric always gets one icon across the whole report: Net Sales is `coin` everywhere, conversion is `chart-funnel` for both stores and web, and anything profit-shaped is `moneybag`. That way the icon carries meaning, not just decoration. Every icon named in this doc is already in the set, so nothing needs generating.

### VAT and currency

Add two small tile slicers to the rail on every page except Data Quality: `'VAT View'[VAT View]` and `'Currency Conversion'[Currency Conversion]`. Use View, then Sync slicers, so a choice follows you around the report.

Any old slicer on `dim_vat_view` does nothing now, so replace it with the new one wherever it appears. Use the plain base measures everywhere (`Net Sales (GBP)`, `Average Transaction Value (GBP)`, and so on). The `(Selected VAT View)` family are only pass-throughs now.

### Visual mix

I try to give every page one of each: a trend over time, a composition or share, a ranking or comparison, a relationship (scatter), and one detail table. Where a page already has the obvious chart on Overview, I've gone for a different angle rather than repeating it.

The report has three heatmaps. There's one headline calendar heatmap in Deneb on Sales, and two native matrix heatmaps, on Retail and Data Quality. There's an optional fourth on Categories.

---

## 1. Overview

Already built, no changes needed. Its KPI row sets the icon for each core metric, and every other page reuses the same icon for the same metric:

| KPI card | Value | Icon |
|---|---|---|
| Net Sales | `Net Sales (GBP)` | `coin` |
| Units | `Net Units Sold` | `package` |
| Gross Margin | `Gross Margin %` | `percentage` |
| Gross Profit | `Gross Profit (GBP)` | `moneybag` |
| Stock Value | `Stock Value (Retail, GBP)` | `building-warehouse` |

The rest of the page is the sales and margin combo, the channel and market bar with LY, the best sellers table with images, the store map, the major product group donut, and the product group YoY table.

The only job left on this page is the VAT slicer swap.

---

## 2. Sales Performance

*How are we trading against last year and target, and on which days?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Net Sales | `Net Sales (GBP)` | `Net Sales YoY Combo` | `coin` |
| vs Target | `Net Sales Target Achievement %` | `Net Sales Target Combo` | `target-arrow` |
| Gross Profit | `Gross Profit (GBP)` | `Gross Profit YoY Combo` | `moneybag` |
| Gross Margin | `Gross Margin %` | `Gross Margin YoY Combo` | `percentage` |
| Transactions | `Distinct Invoices (from Sales)` | `Distinct Invoices YoY Combo` | `receipt` |

| # | Visual | Type | Position (x, y, w, h) | Fields |
|---|---|---|---|---|
| 1 | Actual vs LY vs Target | Line | 227, 268, 1107, 400 | X `business_week_number`. Y `Net Sales (GBP)`, `Net Sales LY`, `Target Net Sales (GBP), Any Grain`. Make LY grey and target dashed. |
| 2 | Target variance by market | Bar (horizontal) | 1346, 268, 555, 400 | Y `dim_store[market_name]`. X `Net Sales Target Variance %`. Bar colour: Rules, below 0 red, 0 and above green. Sort by value. |
| 3 | Trading calendar | Deneb heatmap | 227, 680, 1674, 390 | See [the heatmap section](#the-calendar-heatmap) |

**Notes**

- Visual 1 needs the Any Grain target. The plain target measure returns the whole period's target on every week and draws a staircase.
- I dropped the "sales & margin by month" chart from the first draft because it duplicated the Overview combo.
- I also dropped the channel donut and the market map, since Overview covers both.

---

## 3. Products

*Which lines carry the business, and which ones come back?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Net Sales | `Net Sales (GBP)` | `Net Sales YoY Combo` | `coin` |
| Units | `Net Units Sold` | `Net Units Sold YoY Combo` | `package` |
| Gross Margin | `Gross Margin %` | `Gross Margin YoY Combo` | `percentage` |
| Return Rate | `Return Rate %` | `Return Rate YoY Combo` | `rotate` |
| Gross Profit | `Gross Profit (GBP)` | `Gross Profit YoY Combo` | `moneybag` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Style Pareto | Line and clustered column | 227, 268, 1107, 400 | X `style_label` (never `style_name`, which is shared by up to 8 styles; the Pareto measures go blank on it by design). Columns `Net Sales (GBP)`. Line (secondary axis) `Style Pareto Cumulative %`, with the secondary axis fixed 0 to 100% and a constant line at 80%. Sort by Net Sales descending. |
| 2 | Best sellers | Table | 1346, 268, 555, 400 | `image_url` (Image URL category), `style_name`, `colour`, `Net Sales (GBP)`, `Net Sales YoY Combo`. Top N 15 by Net Sales. |
| 3 | Margin vs volume | Scatter | 227, 680, 831, 390 | Values `product_group`. X `Net Sales (GBP)`. Y `Gross Margin %`. Size `Net Units Sold`. Legend `major_product_group`. Add average lines on both axes to create quadrants. |
| 4 | Return rate by group | Deneb gradient bars | 1070, 680, 831, 390 | `deneb-gradient-bars.json`. Category `product_group`, value `Return Rate %` (switch the label format to `.1%`). |

**Notes**

- Expect a proper Pareto bow. Since the generator gave styles a popularity weight, the top 20% of styles do about 62% of sales and 331 of 907 reach 80%. Before that it took 502, which is why the first version of this chart looked nearly flat.
- The first draft had a Style-Colour Pareto. There's no Style-Colour Pareto measure in the model, and three Paretos on one page was repetitive anyway, so I cut it.
- The Product Group Pareto lives on Categories.
- I used 33 product groups for the scatter rather than brands. There are only four brands, which isn't enough dots to show a relationship.

---

## 4. Categories

*How does the range mix perform, and where?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Top category | `product_group` (card with visual filter Top N 1 by `Net Sales (GBP)`) | none | `trophy` |
| Net Sales | `Net Sales (GBP)` | `Net Sales YoY Combo` | `coin` |
| YoY | `Net Sales YoY %` | `Net Sales YoY Combo` | `trending-up` |
| Gross Margin | `Gross Margin %` | `Gross Margin YoY Combo` | `percentage` |
| vs Target | `Net Sales Target Achievement %` | `Net Sales Target Combo` | `target-arrow` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Range treemap | Treemap | 227, 268, 666, 400 | Category `major_product_group`, Details `product_group`, Values `Net Sales (GBP)` |
| 2 | Product Group Pareto | Line and clustered column | 905, 268, 996, 400 | X `product_group`. Columns `Net Sales (GBP)`. Line `Product Group Pareto Cumulative %` (secondary axis 0 to 100%, constant line at 80%). |
| 3 | Category x Market YoY | Matrix heatmap (optional) | 227, 680, 1107, 390 | Rows `major_product_group` (drill to `product_group`). Columns `dim_store[market_name]`. Values `Net Sales YoY %`. |
| 4 | Margin vs LY | Clustered bar | 1346, 680, 555, 390 | Y `major_product_group`. X `Gross Margin %`, `Gross Margin % LY` |

**Notes**

- For visual 3, use a diverging gradient centred on 0 (see [native heatmaps](#native-matrix-heatmaps)).
- Swap the columns to `brand_name` if you'd rather see range by brand. That was the original Category x Brand matrix.
- If three heatmaps feels like enough, make visual 3 a plain matrix with data bars instead.
- Use `dim_store[market_name]`, not `dim_market[market_name]`. `fact_sales` only reaches markets through `dim_store`.

---

## 5. Retail Performance

*How are the stores trading, converting and earning their space?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Footfall | `Total Footfall` | `Total Footfall Target Combo (Any Grain)` | `walk` |
| Conversion | `Conversion Rate %` | `Conversion Rate YoY Combo` | `chart-funnel` |
| ATV | `Average Transaction Value (GBP)` | `Average Transaction Value YoY Combo` | `receipt-2` |
| IPT | `Items per Transaction` | `Items per Transaction YoY Combo` | `shopping-bag` |
| Sales per Sq Ft | `Sales per Sq Ft (Annualised)` | `Sales per Sq Ft YoY Combo` | `ruler` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Footfall vs conversion | Scatter | 227, 268, 666, 400 | Values `store_name`. X `Total Footfall`. Y `Conversion Rate %`. Size `Retail Sales (GBP)`. Legend `store_type`. Average lines on both axes. |
| 2 | Store league table | Table | 905, 268, 996, 400 | `store_name`, `region`, `store_type`, `Net Sales (GBP)`, `Net Sales YoY Combo`, `Conversion Rate %`, `Sales per Sq Ft (Annualised)`, `Net Contribution %`. Data bars on Net Sales. Background rules on Net Contribution %: below 0 red, 0 to 10% amber. |
| 3 | Trading rhythm | Matrix heatmap | 227, 680, 1107, 390 | Rows `day_name`. Columns `business_period_label`. Values `Total Footfall`. |
| 4 | Footfall vs target | Line | 1346, 680, 555, 390 | X `business_week_number`. Y `Total Footfall`, `Target Total Footfall, Any Grain` (dashed) |

**Notes**

- The rhythm heatmap in visual 3 shows the weekend peak and the seasonal build in one visual. Conversion Rate % works in the same slot. Its spread is narrow (about 16 to 18.5%), but the gradient scales to min and max, so the pattern still reads.
- Add a channel page filter of Retail + Concession so Online doesn't sit in the scatter with zero footfall.
- The league table is also my Desktop test for the store contribution redesign. There should be real spread now, with some stores negative, and `Sales per Sq Ft` should be blank for Online.
- I left the region map off. Overview already has one. If you want it here instead of visual 4, use `dim_store[latitude]` and `[longitude]` with `Retail Sales (GBP)` as size.

---

## 6. Promotional Performance

*What does discounting buy us, and what does it cost in margin?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Full Price Sales | `Full Price Sales (GBP)` | `Full Price Sales YoY Combo` | `tag` |
| Multi-buy Sales | `Multi-buy Sales (GBP)` | `Multi-buy Sales YoY Combo` | `basket` |
| Full Price Mix | `Full Price Mix %` | `Full Price Mix YoY Combo` | `chart-pie` |
| Multi-buy Mix | `Multi-buy Mix %` | `Multi-buy Mix YoY Combo` | `chart-donut` |
| Return Rate | `Return Rate %` | `Return Rate YoY Combo` | `rotate` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Full price vs multi-buy | Stacked area | 227, 268, 1107, 400 | X `business_week_number`. Y `Full Price Sales (GBP)`, `Multi-buy Sales (GBP)` |
| 2 | The cost of discounting | Line and clustered column | 1346, 268, 555, 400 | X `fact_sales[Discount Band]`. Columns `Net Sales (GBP)`. Line `Gross Margin %` |
| 3 | Return rate trend | Line | 227, 680, 666, 390 | X `business_period_label`. Y `Return Rate %`, `Return Rate LY` |
| 4 | Promotion table | Table | 905, 680, 996, 390 | `promo_name`, `promo_type`, `start_date`, `end_date`, `discount_pct`, `Net Sales (GBP)`, `Net Units Sold`, `Gross Margin %`, `Distinct Invoices (from Sales)` |

**Notes**

- Visual 2 is the insight on this page. It shows how much the margin line falls as the discount band deepens. It replaces the separate discount-band bar and the invoice-count distribution from the first draft.
- `Discount Band` has no sort column, so alphabetical order puts "31-50% off" first. For now, sort the visual by `Gross Margin %` descending, which lands close to band order. The proper fix is a `Discount Band Order` column next to it in `fact_sales.tmdl`.

---

## 7. Digital Performance

*How is the website trading and converting, by device, browser and market?*

Rail slicers on this page: week, month and `dim_market[market_name]`.

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Digital Sales | `Digital Net Sales (GBP)` | `Digital Net Sales Target Combo (Any Grain)` | `shopping-cart` |
| Sessions | `Total Sessions` | `Total Sessions YoY Combo` | `click` |
| Conversion | `Digital Conversion Rate %` | `Digital Conversion Rate YoY Combo` | `chart-funnel` |
| Basket | `Average Basket Value (GBP)` | `Average Basket Value YoY Combo` | `basket` |
| Engagement | `Pages per Session` | none | `browser` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Sales and conversion | Line and clustered column | 227, 268, 1107, 400 | X `business_week_number`. Columns `Digital Net Sales (GBP)`. Line `Digital Conversion Rate %` |
| 2 | Sessions by device | Donut | 1346, 268, 555, 400 | Legend `fact_digital_traffic[device_type]`. Values `Total Sessions` |
| 3 | Browsers | Table | 227, 680, 550, 390 | `dim_browser[icon_url]` (Image URL), `browser`, `Total Sessions`, `Pages per Session`. Data bars on Sessions. |
| 4 | Basket by device | Deneb gradient bars | 789, 680, 550, 390 | Category `fact_digital_sales[device_type]`, value `Average Basket Value (GBP)` |
| 5 | Target by market | Bar (horizontal) | 1351, 680, 550, 390 | Y `dim_market[market_name]`. X `Digital Net Sales Target Variance % (Any Grain)`. Rules colour red below 0, green 0 and above. |

**Notes**

- The first draft had "conversion by device". The model can't do that honestly yet. Orders sit on `fact_digital_sales[device_type]` and sessions on `fact_digital_traffic[device_type]`, with no shared device dimension, so conversion by device would divide one device's orders by every device's sessions.
- Fixing it means a small `dim_device` table and two relationships. Run the cycle check first. I've parked it.
- Use `dim_market` here, not `dim_store`. The digital facts don't go through stores.

---

## 8. Finance

*Where does the money go between turnover and net contribution, and which stores earn their keep?*

Rail slicers: `dim_store[store_type]` and `dim_store[market_name]` only. Everything on this page is business period grain, so keep axes on `business_period_label`, never week or month.

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Turnover | `Turnover (GBP)` | none | `building-bank` |
| Gross Contribution | `Gross Contribution %` | `Gross Contribution YoY Combo` | `percentage` |
| Net Contribution | `Net Contribution (GBP)` | `Net Contribution Target Combo` | `moneybag` |
| Net Contribution % | `Net Contribution %` | `Net Contribution Pct YoY Combo` | `scale` |
| Operating Costs | `Store Operating Costs (GBP)` | `Store Operating Costs YoY Combo` | `calculator` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | P&L bridge | Waterfall | 227, 268, 1107, 400 | Category `dim_pnl_bridge[step_name]` (sorted by `step_order`). Y `P&L Bridge Value`. Rename the auto-Total to "Net Contribution". |
| 2 | Cost mix | Donut | 1346, 268, 555, 400 | Values: `Rent (GBP)`, `Staff Costs (GBP)`, `Utilities (GBP)`, `Marketing (GBP)` (no legend field) |
| 3 | Space vs profit | Scatter | 227, 680, 1107, 390 | Values `store_name`. X `Sales per Sq Ft (Annualised)`. Y `Net Contribution %`. Legend `store_type`. Constant line at Y = 0. |
| 4 | Contribution trend | Line | 1346, 680, 555, 390 | X `business_period_label`. Y `Gross Contribution %`, `Net Contribution %` |

**Notes**

- Visual 3 tells the square footage story. The stores bottom-left are big footprints trading thinly. Concessions should cluster healthy by design.
- This replaces the existing Net Sales vs Net Contribution % scatter at (1000, 93), which overlaps the KPI row.
- "Turnover" is Retail + Concession only, about 81.5% of company sales. Online has no cost lines to bridge. Put that in the waterfall's subtitle so nobody compares it with Net Sales on the Sales page.
- The waterfall and the cost donut are also my first Desktop look at the rebuilt bridge. It should reconcile exactly to Net Contribution (GBP).

---

## 9. Stock

*Have we got the right stock in the right place for how fast it sells?*

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Stock Units | `Stock Units` | `Stock Units YoY Combo` | `box` |
| Stock at Retail | `Stock Value (Retail, GBP)` | `Stock Value Retail YoY Combo` | `building-warehouse` |
| Stock at Cost | `Stock Value (Cost, GBP)` | `Stock Value Cost YoY Combo` | `truck-delivery` |
| Weeks of Cover | `Weeks of Cover` | `Weeks of Cover YoY Combo` | `hourglass-high` |
| Rate of Sale | `Avg Weekly Sales (Units)` | `Avg Weekly Sales YoY Combo` | `calendar-week` |

| # | Visual | Type | Position | Fields |
|---|---|---|---|---|
| 1 | Stock value trend | Deneb gradient area (fade) | 227, 268, 1107, 400 | `deneb-gradient-area-fade.json`. Category and sort_key `full_date` (week ending), value `Stock Value (Retail, GBP)` |
| 2 | Cover by group | Bar (horizontal) | 1346, 268, 555, 400 | Y `fact_stock_snapshot[product_group]`. X `Weeks of Cover`. Rules colour: under 4 red, 4 to 20 teal, over 20 amber. |
| 3 | Stock vs velocity | Scatter | 227, 680, 831, 390 | Values `fact_stock_snapshot[product_group]`. X `Avg Weekly Sales (Units)`. Y `Stock Units`. Size `Stock Value (Retail, GBP)` |
| 4 | Stock by market | Table | 1070, 680, 831, 390 | `dim_store[market_name]`, `Stock Value (Retail, GBP)`, `Stock Value Retail YoY Combo`, `Weeks of Cover` |

**Notes**

- Stock is a weekly closing balance. The measures already take the last snapshot in the filter context, so a period axis shows closing stock, not the sum of every week.
- Non-GBP stock values convert at the average rate for now. The closing-rate convention is still on the roadmap.

---

## 10. Data Quality

*Can I trust the numbers on the other nine pages?*

The page shell exists (it was copied from Sales), so it needs clearing first:

- Delete the Net Sales card and its sparkline.
- Delete the five rail slicers and the `business_year` slicer. None of them touch the DQ tables.
- Put one vertical tile slicer on `dq_check_results[category]` in the rail at 19, 619, 160, 300.
- Keep `Report Last Refreshed`.

The full field-by-field detail, colours and expected numbers are in `docs/data-quality-page.md`, which has the 1920 x 1080 layout below.

| KPI card | Value | Reference label | Icon |
|---|---|---|---|
| Score | `Data Quality Score` | `DQ Checks Passed Label` | `shield-check` |
| Status | `DQ Overall Status` | none | `circle-check` |
| Rows tested | `DQ Scored Rows Tested` | none | `database` |
| Latest data | `DQ Latest Data Date` | `DQ Freshness Summary` | `clock` |
| Fixed in cleaning | `DQ Rows Fixed in Cleaning` | `DQ Raw Rows Received` | `filter` |

| # | Visual | Type | Position |
|---|---|---|---|
| 1 | Checks by status | Donut | 227, 268, 400, 400 |
| 2 | What cleaning fixed | Bar | 639, 268, 600, 400 |
| 3 | Where the problems sit | Matrix heatmap | 1251, 268, 650, 400 |
| 4 | All check results | Table | 227, 680, 1107, 390 |
| 5 | Reconciliation | Table | 1346, 680, 555, 190 |
| 6 | Table profile and freshness | Table | 1346, 880, 555, 190 |

**Notes**

- The heatmap in visual 3 replaces the "score by category" bar from the first draft. Its column totals are the score by category, so the bar was redundant.

---

## The heatmaps

### The calendar heatmap

This goes on Sales, visual 3. The spec is `powerbi/deneb/deneb-calendar-heatmap.json`. It shows every trading day of the latest business year in the filter as a 52-week by 7-day grid, darker for bigger days. Christmas Day, Boxing Day and Black Friday get a gold outline.

Values well, all from `dim_date` plus the measure:

- `full_date`
- `day_name`
- `day_of_week_num`
- `business_year`
- `business_week_number`
- `business_period_label`
- `Net Sales (GBP)`

`is_black_friday`, `is_christmas_day` and `is_boxing_day` are optional. Leave them out and you just lose the outlines.

Things I handled in the spec so you don't have to:

- If more than one business year is selected, it shows the latest one only. Two years would stack cells on top of each other.
- The week starts on Sunday, matching the retail week in `dim_date`.
- The colour scale is square-root rather than linear, so a handful of big Saturdays don't wash every weekday out to the same pale colour.
- Future dates have no sales, so Power BI never passes them to Deneb. A part-year grid simply stops at the latest week. The last cell can look pale because the current day is only partly traded.
- To show something other than Net Sales, change the `value` line at the top of `transform`. For a percentage, also change the label format.

I rendered it against the real BY25 data before committing. It shows three things straight away: Saturday is the biggest day most weeks, trade steps up around week 22 when the AW range lands, and the key days stand out. Black Friday is the darkest cell of the year, Boxing Day is next to it, and Christmas Day is almost blank because the stores are shut and only Online trades.

The first render showed something I didn't expect: all three key days looked like ordinary days, and every store traded on Christmas Day. The flags existed in `dim_date`, but the sales generator never used them. That's fixed now (see `build_fact_sales.py`), and it's a good example of the heatmap earning its place.

### Native matrix heatmaps

Retail visual 3, Categories visual 3 and Data Quality visual 3 are ordinary matrix visuals with background colour turned on. They're built the same way:

1. Add a Matrix with the rows, columns and value from the page table.
2. Under Format, then Row subtotals and Column subtotals, turn both off. The DQ one is the exception: keep column subtotals on there, since they're the score by category.
3. Under Cell elements, pick the value series and turn Background colour on.
   - **Sequential (Retail):** Format style Gradient, lowest value `#EAF2F3`, highest value `#1F7486`.
   - **Diverging (Categories YoY):** Gradient, tick "Add a middle colour". Set Minimum to Number -0.2 with `#D32F2F`, Center to Number 0 with `#F5F1EA`, and Maximum to Number 0.2 with `#2E7D32`. Fixed numbers stop a single outlier from flattening everything else.
   - **Rules (Data Quality):** Format style Rules on `Data Quality Score`. If value is 1 then `#2E7D32`. If value is 0.9 or more and below 1 then `#F9A825`. If value is below 0.9 then `#D32F2F`. Blank cells stay blank, which matters because most tables don't have a check in every category.
4. Under Grid, set white horizontal and vertical gridlines at 2px so the cells separate.
5. Turn off auto-size column width and set every column to the same width, so the cells come out square-ish.
6. To make it a pure heatmap with no numbers, set Font colour to the same rule as the background. I'd keep the numbers on Retail and DQ and hide them on Categories.

`day_name` already sorts by `day_of_week_num`, and `business_period_label` by `period_key`, so the rows and columns come out in the right order without any extra work.

---

## Build order

I'd build in this order so the new model work gets tested as it goes:

1. **Sales.** The KPI combos are the VAT and currency test. Net Sales and the targets should move with both toggles. Gross Profit should move with currency only.
2. **Retail.** This tests the square footage and contribution redesign.
3. **Finance.** First look at the waterfall in Desktop.
4. **Data Quality.** Clear-down plus six visuals.
5. **Products, Categories, Promo, Digital, Stock.**
6. Bump the measure count in the README and diagrams from 385 to 395 once 1 to 3 check out.