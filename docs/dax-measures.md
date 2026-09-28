# Power BI model reference

Rebuilt from scratch against the current schema — the version this
replaces was written before the invoice grain, business_year rename,
dim_period, and fact_store_finance existed. Written for pasting into
Power BI Desktop, not run there myself — I don't have access to it.
Standard, well-established DAX patterns throughout, but flag anything
that errors and I'll fix it.

## Relationships

All single-direction, many-to-one from fact/many-grain to dimension/one-grain
unless noted.

| From | To | Notes |
|---|---|---|
| `fact_sales[date]` | `dim_date[full_date]` | |
| `fact_sales[store_id]` | `dim_store[store_id]` | |
| `fact_sales[sku]` | `dim_product[sku]` | |
| `fact_sales[promo_id]` | `dim_promo[promo_id]` | Includes the two MULTIBUY- rows, not just the %-off calendar. |
| `fact_sales[currency]` | `dim_currency[currency_code]` | |
| `fact_footfall[date]` | `dim_date[full_date]` | |
| `fact_footfall[store_id]` | `dim_store[store_id]` | |
| `fact_stock_snapshot[week_ending_date]` | `dim_date[full_date]` | |
| `fact_stock_snapshot[store_id]` | `dim_store[store_id]` | |
| `fact_targets[store_id]` | `dim_store[store_id]` | |
| `fact_targets[period_key]` | `dim_period[period_key]` | Not `dim_date` — see below. |
| `fact_store_finance[store_id]` | `dim_store[store_id]` | |
| `fact_store_finance[period_key]` | `dim_period[period_key]` | Not `dim_date` — see below. |
| `dim_date[period_key]` | `dim_period[period_key]` | Many-to-one (many days, one period). This is what makes a period filter cascade down to the daily-grain facts too, not just the period-grain ones. |

**Why `dim_period` and not straight to `dim_date`:** `period_key` isn't unique in `dim_date` — it repeats once per day within a period (28–35 times). It isn't unique in `fact_targets`/`fact_store_finance` either — once per store within a period. Relating either fact directly to `dim_date` on `period_key` would be a many-to-many relationship on both sides, which Power BI allows but handles with real caveats (ambiguous cross-filter direction, easy to get wrong without realising it). `dim_period` is a 48-row bridge table (4 years × 12 periods) with `period_key` as a genuine unique key, so both facts get an ordinary one-to-many relationship instead.

**`fact_stock_snapshot` does NOT relate to `dim_product`.** Style+colour grain, one level up from `dim_product`'s SKU grain — `brand_code`/`division`/`major_product_group`/`product_group` are already denormalised directly onto the fact table for this reason. Don't try to build this relationship.

**`fx_rate_monthly` is left unrelated.** `fact_sales` already carries both `net_sales_gbp` and `net_sales_local` precomputed, so nothing needs a rate lookup at query time. Only relate it if you specifically want an FX-rate trend visual.

Mark `dim_date` as the date table (`full_date` as the key). Needed for time intelligence to work correctly even though the YoY measures below use explicit `business_year` filtering — our business year is a fixed 364-day block starting in March, not a Gregorian year, so `SAMEPERIODLASTYEAR` would give the wrong answer.

## DAX measures

### Sales & margin

```dax
Net Sales (GBP) =
SUM ( fact_sales[net_sales_gbp] )

Gross Cost (GBP) =
SUM ( fact_sales[cost_gbp] )

Gross Profit (GBP) =
[Net Sales (GBP)] - [Gross Cost (GBP)]

Gross Margin % =
DIVIDE ( [Gross Profit (GBP)], [Net Sales (GBP)] )

Gross Units Sold =
CALCULATE ( SUM ( fact_sales[quantity] ), fact_sales[is_return] = FALSE )

Units Returned =
CALCULATE ( -SUM ( fact_sales[quantity] ), fact_sales[is_return] = TRUE )

Return Rate % =
DIVIDE ( [Units Returned], [Gross Units Sold] )

Net Units Sold =
SUM ( fact_sales[quantity] )
-- gross sold minus returns — returns are already stored as negative quantity

Full Price Sales (GBP) =
CALCULATE ( [Net Sales (GBP)], fact_sales[promo_id] = "PROMO0000" )

Full Price Mix % =
DIVIDE ( [Full Price Sales (GBP)], [Net Sales (GBP)] )

Multi-buy Sales (GBP) =
CALCULATE ( [Net Sales (GBP)], LEFT ( fact_sales[promo_id], 9 ) = "MULTIBUY-" )

Multi-buy Mix % =
DIVIDE ( [Multi-buy Sales (GBP)], [Net Sales (GBP)] )
```

Calculated column on `fact_sales` (buckets a row-level field, not an aggregate — doesn't belong as a measure). Multi-buy gets its own band now rather than falling into the %-off tiers, since it's a genuinely different mechanic:

```dax
Discount Band =
SWITCH (
    TRUE (),
    fact_sales[promo_id] = "PROMO0000", "Full Price",
    LEFT ( fact_sales[promo_id], 9 ) = "MULTIBUY-", "Multi-buy",
    fact_sales[discount_pct] <= 30, "Up to 30% off",
    fact_sales[discount_pct] <= 50, "31-50% off",
    fact_sales[discount_pct] <= 70, "51-70% off",
    "70%+ off"
)
```

### VAT

```dax
VAT (GBP) =
SUM ( fact_sales[vat_gbp] )

Gross Sales inc. VAT (GBP) =
SUM ( fact_sales[gross_sales_gbp] )
```

### Time intelligence (business-calendar aware)

```dax
-- Same business year minus one, same period, week and weekday. Works at year,
-- period, week and day level, and under a day-of-week slicer. A day compares
-- with the same weekday 364 days earlier.
Net Sales LY =
VAR CurrentYear = MAX ( dim_date[business_year] )
VAR RelevantPeriodNumbers = VALUES ( dim_date[business_period_number] )
VAR RelevantWeekNumbers = VALUES ( dim_date[business_week_number] )
VAR RelevantWeekdays = VALUES ( dim_date[day_of_week_num] )
RETURN
    CALCULATE (
        [Net Sales (GBP)],
        REMOVEFILTERS ( dim_date ),
        dim_date[business_year] = CurrentYear - 1,
        TREATAS ( RelevantPeriodNumbers, dim_date[business_period_number] ),
        TREATAS ( RelevantWeekNumbers, dim_date[business_week_number] ),
        TREATAS ( RelevantWeekdays, dim_date[day_of_week_num] )
    )

Net Sales YoY % =
DIVIDE ( [Net Sales (GBP)] - [Net Sales LY], [Net Sales LY] )
```

### Targets

```dax
Target Net Sales (GBP) =
SUM ( fact_targets[target_net_sales_gbp] )

Target Variance (GBP) =
[Net Sales (GBP)] - [Target Net Sales (GBP)]

Target Variance % =
DIVIDE ( [Target Variance (GBP)], [Target Net Sales (GBP)] )

Target Achievement % =
DIVIDE ( [Net Sales (GBP)], [Target Net Sales (GBP)] )
```

Some periods have a target with no actual yet (the ones beyond the present-date cutoff) — `[Net Sales (GBP)]` correctly returns blank for those rather than zero, so `Target Achievement %` will show blank too, which is the right behaviour for a period that hasn't happened.

### Gross & net contribution (from fact_store_finance)

This is the table for the turnover → profit waterfall. One note on structure: `fact_store_finance[net_sales_gbp]` is its own period-level rollup column, separate from `fact_sales[net_sales_gbp]` — they reconcile to the same figure when filtered to the same store/period, but they're physically different columns in different tables. Use `fact_store_finance`'s own columns for anything contribution-related, not `[Net Sales (GBP)]`.

```dax
Cost of Goods (GBP) =
SUM ( fact_store_finance[cogs_gbp] )

Rent (GBP) =
SUM ( fact_store_finance[rent_gbp] )

Staff Costs (GBP) =
SUM ( fact_store_finance[staff_gbp] )

Utilities (GBP) =
SUM ( fact_store_finance[utilities_gbp] )

Marketing (GBP) =
SUM ( fact_store_finance[marketing_gbp] )

Store Operating Costs (GBP) =
[Rent (GBP)] + [Staff Costs (GBP)] + [Utilities (GBP)] + [Marketing (GBP)]

Gross Contribution (GBP) =
SUM ( fact_store_finance[gross_contribution_gbp] )

Gross Contribution % =
DIVIDE ( [Gross Contribution (GBP)], SUM ( fact_store_finance[net_sales_gbp] ) )

Head Office Allocation (GBP) =
SUM ( fact_store_finance[head_office_gbp] )

Net Contribution (GBP) =
SUM ( fact_store_finance[net_contribution_gbp] )

Net Contribution % =
DIVIDE ( [Net Contribution (GBP)], SUM ( fact_store_finance[net_sales_gbp] ) )
```

Waterfall category order (turnover → profit): Net Sales → Cost of Goods → Gross Profit → Rent → Staff Costs → Utilities → Marketing → Gross Contribution → Head Office Allocation → Net Contribution. Each is its own measure above; a waterfall visual (native, or Deneb if you want more control over the connector styling) takes them as separate category/value pairs.

### Stock

```dax
Stock Units =
SUM ( fact_stock_snapshot[stock_units] )

Stock Value (Cost, GBP) =
SUM ( fact_stock_snapshot[stock_value_cost_gbp] )

Stock Value (Retail, GBP) =
SUM ( fact_stock_snapshot[stock_value_retail_gbp] )

Avg Weekly Sales (Units) =
DIVIDE ( [Gross Units Sold], DISTINCTCOUNT ( dim_date[business_week_number] ) )

Weeks of Cover =
DIVIDE ( [Stock Units], [Avg Weekly Sales (Units)] )
```

`Weeks of Cover` only makes sense filtered to the latest stock snapshot week, not summed across every week in the table — pair it with a "latest week" filter or slicer.

### Footfall & conversion

```dax
Footfall =
SUM ( fact_footfall[footfall] )

Transactions =
SUM ( fact_footfall[transactions] )

Conversion Rate % =
DIVIDE ( [Transactions], [Footfall] )

Items per Transaction =
DIVIDE ( [Gross Units Sold], [Transactions] )

Average Transaction Value (GBP) =
DIVIDE ( [Net Sales (GBP)], [Transactions] )
```

Optional sanity-check measure, not meant for a report page — `fact_footfall[transactions]` is now a genuine count sourced from `fact_sales`' real `invoice_id`, not an estimate, so this should match `[Transactions]` exactly when filtered to the same store/date range. Worth pasting in once just to confirm the two tables agree before trusting either:

```dax
Distinct Invoices (from Sales) =
CALCULATE ( DISTINCTCOUNT ( fact_sales[invoice_id] ), fact_sales[is_return] = FALSE )
```
```
### Range analysis

These answer "have we got the right number of styles and colours for the sales we get?". Put any product attribute (gender, product group, major product group, brand, sub-brand, season) on rows, then the sales share next to the style and style-colour shares. A row where the range share is well above the sales share carries more range than it earns.

```dax
Styles Sold =
CALCULATE (
    COUNTROWS ( SUMMARIZE ( fact_sales, dim_product[style_code] ) ),
    fact_sales[is_return] = FALSE
)

Style-Colours Sold =
CALCULATE (
    COUNTROWS ( SUMMARIZE ( fact_sales, dim_product[style_code], dim_product[colour_code] ) ),
    fact_sales[is_return] = FALSE
)

Styles in Range =
DISTINCTCOUNT ( dim_product[style_code] )

Style-Colours in Range =
COUNTROWS ( SUMMARIZE ( dim_product, dim_product[style_code], dim_product[colour_code] ) )

Colours per Style =
DIVIDE ( [Style-Colours Sold], [Styles Sold] )

Net Sales Share % =
DIVIDE ( [Net Sales (GBP)], CALCULATE ( [Net Sales (GBP)], ALLSELECTED ( dim_product ) ) )

Styles Sold Share % =
DIVIDE ( [Styles Sold], CALCULATE ( [Styles Sold], ALLSELECTED ( dim_product ) ) )

Style-Colours Sold Share % =
DIVIDE ( [Style-Colours Sold], CALCULATE ( [Style-Colours Sold], ALLSELECTED ( dim_product ) ) )

Style Share Gap (pp) =
[Net Sales Share %] - [Styles Sold Share %]

Style-Colour Share Gap (pp) =
[Net Sales Share %] - [Style-Colours Sold Share %]

Style Productivity Index =
DIVIDE ( [Net Sales Share %], [Styles Sold Share %] )

Style-Colour Productivity Index =
DIVIDE ( [Net Sales Share %], [Style-Colours Sold Share %] )

Net Sales per Style (GBP) =
DIVIDE ( [Net Sales (GBP)], [Styles Sold] )

Net Sales per Style-Colour (GBP) =
DIVIDE ( [Net Sales (GBP)], [Style-Colours Sold] )

Gross Profit Share % =
DIVIDE ( [Gross Profit (GBP)], CALCULATE ( [Gross Profit (GBP)], ALLSELECTED ( dim_product ) ) )

Style Productivity Index (GP) =
DIVIDE ( [Gross Profit Share %], [Styles Sold Share %] )

Styles for 80% of Sales % =
VAR StyleSales =
    FILTER (
        ADDCOLUMNS ( VALUES ( dim_product[style_code] ), "@Sales", [Net Sales (GBP)] ),
        [@Sales] > 0
    )
VAR Target = SUMX ( StyleSales, [@Sales] ) * 0.8
VAR WithCumulative =
    ADDCOLUMNS (
        StyleSales,
        "@Cumulative",
            VAR ThisSales = [@Sales]
            RETURN SUMX ( FILTER ( StyleSales, [@Sales] >= ThisSales ), [@Sales] )
    )
VAR Threshold = MINX ( FILTER ( WithCumulative, [@Cumulative] >= Target ), [@Cumulative] )
VAR StylesNeeded = COUNTROWS ( FILTER ( WithCumulative, [@Cumulative] <= Threshold ) )
RETURN
    DIVIDE ( StylesNeeded, COUNTROWS ( StyleSales ) )
```

A few things worth knowing before using these:

- **"Sold" vs "in Range".** The Sold counts only include styles with a sale line in the current filters, so they follow the date, store and market slicers. The in-Range counts are the whole catalogue for the product filters and ignore dates, because `dim_product` has no dates. The shares and indices use Sold, so a period comparison compares what actually traded.
- **The shares add up to 100%** down gender, product group, major group, brand, sub-brand and season, because each style sits in exactly one of each. The style shares don't add up against colour or size, since a style spans several; the style-colour shares do add up against colour.
- **ALLSELECTED** means a product slicer on the page sets the 100%. With a brand slicer on one brand, the Mens row is Mens' share of that brand.
- **Reading a low index.** The index is relative to the business average, so it tells you where to look, not that a group definitely has too many styles. Two measures help with the next question. **Gross Profit Share %** and **Style Productivity Index (GP)** show whether a lower-selling group earns its range on margin. **Styles for 80% of Sales %** shows the shape: a low figure means a few strong styles and a tail worth cutting, and a high figure means sales are spread thinly across the whole group.
- **VAT and currency.** The shares are ex-VAT by design, so they don't move because one market has a higher VAT rate. The two per-style averages are on the VAT View whitelist, and the Currency Conversion group converts them because they carry a £ format.

As a sanity check, over the last year on the current data, Accessories makes about 3% of sales from about 16% of the selling styles, and Outerwear about 34% of sales from about 23%. So the measures tell a story straight away.

On the same year, Tops need about half their styles to reach 80% of their sales, against about 38–42% for most groups, so Tops sales are spread thinly across the range. Gross Profit share tracks sales share almost exactly for every group, because the generator gives every product group a similar margin. The GP measures are right; the synthetic data just doesn't give them much to find yet.