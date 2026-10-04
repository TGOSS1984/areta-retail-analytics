# Power BI model reference

How the model fits together and the patterns behind the measures. It isn't a list of all 472. Most measures are one of a handful of patterns repeated across metrics, so this covers the patterns, the measures that do something unusual, and the reasons behind both. Every measure is in the TMDL under `powerbi/areta-retail-analytics.SemanticModel/definition/tables/`, and the trickier ones carry a description you can hover over in Desktop.

## Relationships

Everything is single direction, many to one, from the fact to the dimension.

| From | To | Notes |
|---|---|---|
| `fact_sales[date]`, `fact_footfall[date]`, `fact_digital_sales[date]`, `fact_digital_traffic[date]` | `dim_date[full_date]` | |
| `fact_stock_snapshot[week_ending_date]` | `dim_date[full_date]` | Stock only exists on week-ending Saturdays |
| `fact_sales`, `fact_footfall`, `fact_stock_snapshot`, `fact_targets`, `fact_store_finance` `[store_id]` | `dim_store[store_id]` | |
| `fact_sales[sku]` | `dim_product[sku]` | |
| `fact_sales[promo_id]` | `dim_promo[promo_id]` | Includes the four multi-buy rows as well as the %-off promotions |
| `fact_sales[currency]`, `fx_rate_monthly[currency_code]` | `dim_currency[currency_code]` | |
| `fact_targets[period_key]`, `fact_store_finance[period_key]`, `fact_digital_targets[period_key]` | `dim_period[period_key]` | |
| `fact_digital_sales[market_code]` | `dim_market[market_code]` | |
| `fact_digital_traffic[browser]` | `dim_browser[browser]` | |
| `dim_date[business_period_label]` | `dim_period[business_period_label]` | **Inactive** |
| `fact_digital_traffic[market_code]`, `fact_digital_targets[market_code]` | `dim_market[market_code]` | **Inactive** |

`dim_pnl_bridge`, `dim_funnel_stage`, `dim_report_metadata`, the two DQ tables and the two calculation groups have no relationships at all.

### Why the period-grain facts use TREATAS

Targets and store finance are stored per store per business period, so they hang off `dim_period`. The obvious move is to relate `dim_date` to `dim_period` too, so a date filter flows down to them. I tried it, and it caused the two worst bugs in the project: a cyclic reference that blocked the refresh, and figures three to four times too high once a slicer was involved (both are in the README's lessons). So that relationship is inactive, and every period-grain measure carries the date filter across itself:

```dax
Target Net Sales (GBP) =
VAR RelevantPeriods = VALUES ( dim_date[business_period_label] )
RETURN
    CALCULATE (
        SUM ( fact_targets[target_net_sales_gbp] ),
        TREATAS ( RelevantPeriods, dim_period[business_period_label] )
    )
```

The finance measures (`Turnover (GBP)`, `Net Contribution (GBP)` and the rest) follow the same pattern. The digital traffic and digital targets measures do the same with `dim_market`, which is why their relationships to it are inactive.

### Why stock uses TREATAS onto the product

`fact_stock_snapshot` is at store, style and colour grain, one level above `dim_product`'s SKU, so there's no relationship between them. The stock measures map the product filter across instead:

```dax
Stock Units =
VAR LastSnapshot = MAX ( fact_stock_snapshot[week_ending_date] )
RETURN
    CALCULATE (
        SUM ( fact_stock_snapshot[stock_units] ),
        fact_stock_snapshot[week_ending_date] = LastSnapshot,
        KEEPFILTERS ( TREATAS ( VALUES ( dim_product[style_code] ), fact_stock_snapshot[style_code] ) ),
        KEEPFILTERS ( TREATAS ( VALUES ( dim_product[colour] ), fact_stock_snapshot[colour] ) )
    )
```

Two things are going on there. Stock is a closing balance, so it takes the last snapshot in the filter rather than adding every week together (period 5 once showed 1,041,686 units because of that). And the stock table's own product columns are hidden: put `fact_stock_snapshot[product_group]` on an axis and the stock follows it but sales don't, so Weeks of Cover divides each group's stock by company-wide sales and reads a fraction of a week. Product fields on stock visuals always come from `dim_product`.

Mark `dim_date` as the date table, with `full_date` as the key. None of the measures use the built-in time intelligence functions anyway. The business year is a fixed 364-day block starting in March, so `SAMEPERIODLASTYEAR` would compare the wrong days.

## Sales and margin

The base measures are plain sums. Returns are stored as negative quantities and values, so they net off without any special handling.

```dax
Net Sales (GBP) =
SUM ( fact_sales[net_sales_gbp] )

Gross Profit (GBP) =
[Net Sales (GBP)] - [Gross Cost (GBP)]

Gross Margin % =
DIVIDE ( [Gross Profit (GBP)], [Net Sales (GBP)] )

Gross Units Sold =
CALCULATE ( SUM ( fact_sales[quantity] ), fact_sales[is_return] = FALSE )

Return Rate % =
DIVIDE ( [Units Returned], [Gross Units Sold] )

Full Price Sales (GBP) =
CALCULATE ( [Net Sales (GBP)], fact_sales[promo_id] = "PROMO0000" )

Multi-buy Sales (GBP) =
CALCULATE ( [Net Sales (GBP)], LEFT ( fact_sales[promo_id], 9 ) = "MULTIBUY-" )

Distinct Invoices (from Sales) =
CALCULATE ( DISTINCTCOUNT ( fact_sales[invoice_id] ), fact_sales[is_return] = FALSE )

Average Order Value (GBP) =
DIVIDE ( [Net Sales (GBP)], [Distinct Invoices (from Sales)] )
```

Every return is coded `PROMO0000`, whatever the original sale was on, so Full Price carries all the refunds in the business and the full price mix reads slightly low.

`Discount Band` is a calculated column on `fact_sales`, because it buckets each row rather than aggregating:

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

## Last year and the KPI set

Every "compared with last year" measure uses the same shape. It moves the business year back by one and carries the period, week and weekday across, so it works at year, period, week or day level and a day compares with the same weekday 364 days earlier:

```dax
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
```

Finance is period grain, so its LY measures only carry the period number across. They used to filter `dim_period[business_year]` instead, which the report's year buttons (on `dim_date`) don't touch, so LY came back equal to this year and every finance YoY card read 0.0.

Around each LY sits a set of measures that drives a KPI card: YoY (GBP or pp), YoY %, a Trend Arrow, a Trend Colour and a Combo, the line of text under the card value:

```dax
Net Sales Trend Colour =
IF ( [Net Sales YoY %] > 0, "#2E7D32", IF ( [Net Sales YoY %] < 0, "#D32F2F", "#8D9AA1" ) )

Net Sales YoY Combo =
VAR VatFactor =
    IF (
        SELECTEDVALUE ( 'VAT View'[VAT View], "Excluding VAT" ) = "Including VAT",
        DIVIDE ( SUM ( fact_sales[gross_sales_gbp] ), SUM ( fact_sales[net_sales_gbp] ), 1 ),
        1
    )
VAR CcyFactor = [FX Rate (Selected)]
VAR Factor = VatFactor * CcyFactor
RETURN
    [Net Sales Trend Arrow] & " £" & FORMAT ( ABS ( [Net Sales YoY (GBP)] * Factor ), "#,0" )
        & " (" & FORMAT ( [Net Sales YoY %], "+0.0%;-0.0%;0.0%" ) & ")"
```

A few metrics turn the colour round. Basket and checkout abandonment are good news when they fall, so down is green, and Online Share is always grey, because a rising online share can mean stores are struggling as easily as online is thriving.

## Targets

Targets are per store per period, so a weekly chart against the plain target shows the whole period's target on every week (a staircase, and a variance of about −80%). The `Any Grain` versions spread each period's target across its days in proportion to last year's trading on the same weekday, so they add back up to the period target and work on a weekly or daily axis. Use them on anything below period level.

## VAT and currency

Two calculation groups, `VAT View` and `Currency Conversion`, change the outermost measure in a visual.

- **VAT View** has a whitelist of the sales-value measures it applies to (net sales, LY, YoY, targets, average order value, average selling price and a few others), and multiplies them by gross over net. Anything ex-VAT by definition, like gross profit, margin and cost, is left alone.
- **Currency Conversion** converts any measure with a £ format string at the selected rate, and leaves percentages and counts alone.

Calculation groups only touch the outermost measure, which matters for the combos: a combo is text built from other measures, so it builds the VAT and currency factors into its own DAX, as above. Ratios, mix measures and shares are ex-VAT by design, so they don't move because one market has a higher VAT rate.

## Contribution and the P&L bridge

`fact_store_finance` is its own period-level table, with its own `net_sales_gbp`. It reconciles to `fact_sales` for the same stores and periods (check REC-01), but contribution measures always use the finance table's columns, never `[Net Sales (GBP)]`. On the report it's labelled Turnover, because it covers Retail and Concession only: Online has no rent or staff lines.

The waterfall uses a disconnected table, `dim_pnl_bridge`, with one row per step in order (turnover, marketing, head office, utilities, staff, rent, cost of goods), and a single `P&L Bridge Value` measure that returns turnover as a positive and each cost as a negative. There's deliberately no net contribution row: the waterfall works out the running total itself as its last bar, and a row for it as well would count it twice. That total is the net contribution, and it reconciles exactly to the Net Contribution card.

## Stock and weeks of cover

```dax
Avg Weekly Sales (Units) =
VAR WeeksTraded =
    COUNTROWS ( SUMMARIZE ( fact_sales, dim_date[business_year], dim_date[business_week_number] ) )
RETURN
    DIVIDE ( [Gross Units Sold], WeeksTraded )

Weeks of Cover =
DIVIDE ( [Stock Units], [Avg Weekly Sales (Units)] )
```

`Avg Weekly Sales` counts year-and-week pairs that actually traded. The first version counted every week number in the filter, which divided a part year by future weeks (2026 to date read 21.8 weeks of cover instead of 13.0) and halved the rate when two years were selected.

Weeks of Cover is closing stock over the average weekly rate across whatever window is selected, so a year blends peak and quiet weeks. `Weeks of Cover (Last 4 Weeks)` uses the rate in the four weeks up to the closing date instead, which is how a merchandiser would quote it.

## Footfall and conversion

```dax
Conversion Rate % =
DIVIDE ( [Total Transactions], [Total Footfall] )

Average Transaction Value (GBP) =
DIVIDE ( [Net Sales (GBP)], [Total Transactions] )
```

`Total Transactions` comes from `fact_footfall`, which only exists for Retail and Concession stores. That's fine on the Retail page, which is filtered to stores, but anywhere Online is in scope ATV counts online sales without counting online orders (about £98 for BY25 instead of £81). Use `Average Order Value (GBP)` there. `fact_footfall[transactions]` is built from the real invoices in `fact_sales`, and REC-04 checks the two agree.

## Pareto and the top performers

The Pareto measures rank styles, style-colours or product groups by Net Sales and return the cumulative share. Style Pareto runs on `dim_product[style_label]` (name, brand and code) rather than `style_name`, because 907 styles share 498 names and an axis on the name merges them.

`Top Style`, `Top Style-Colour` and `Top Product Group` find the winner themselves with `TOPN`, and each has a matching `Net Sales` and `Share %` measure for the card's reference lines. The cards need no visual filter. A filter on the winner would shrink the share to the filtered slice, which is how a Top Style card once said 89.2% instead of 1.8%.

## Range analysis

These answer "have we got the right number of styles and colours for the sales we get?". Put any product attribute (gender, product group, major product group, brand, sub-brand, season) on rows, then the sales share next to the style and style-colour shares. A row where the range share is well above the sales share carries more range than it earns.

```dax
Styles Sold =
CALCULATE (
    COUNTROWS ( SUMMARIZE ( fact_sales, dim_product[style_code] ) ),
    fact_sales[is_return] = FALSE
)

Style-Colours Sold =
CALCULATE (
    COUNTROWS ( SUMMARIZE ( fact_sales, dim_product[style_colour_code] ) ),
    fact_sales[is_return] = FALSE
)

Styles in Range =
DISTINCTCOUNT ( dim_product[style_code] )

Style-Colours in Range =
DISTINCTCOUNT ( dim_product[style_colour_code] )

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

On the same year, Tops need about 39% of their styles to reach 80% of their sales, against 26–32% for most groups, so Tops sales are spread thinly across the range rather than carried by a few heroes. Margin now varies by category, so the GP view has something to say too: Footwear makes about 21% of sales but under 20% of gross profit, and Outerwear's margin share runs slightly ahead of its sales share.

## Digital funnel

The funnel stages are columns on `fact_digital_traffic`, so every measure here comes from one table and slices by device and browser as well as market and date. Each stage counts sessions that got at least that far, so they only narrow (data quality check VAL-24), and `Order Sessions` adds up to `Digital Orders` (REC-07).

```dax
Basket Sessions =
CALCULATE (
    SUM ( fact_digital_traffic[basket_sessions] ),
    KEEPFILTERS ( TREATAS ( VALUES ( dim_market[market_code] ), fact_digital_traffic[market_code] ) )
)
-- Product View Sessions, Checkout Sessions and Order Sessions follow the same pattern.

Add to Basket Rate % =
DIVIDE ( [Basket Sessions], [Total Sessions] )

Basket Abandonment % =
VAR Baskets = [Basket Sessions]
RETURN
    IF ( Baskets > 0, 1 - DIVIDE ( [Order Sessions], Baskets ) )

Checkout Abandonment % =
VAR Checkouts = [Checkout Sessions]
RETURN
    IF ( Checkouts > 0, 1 - DIVIDE ( [Order Sessions], Checkouts ) )

Funnel Conversion Rate % =
DIVIDE ( [Order Sessions], [Total Sessions] )

Funnel Value =
SWITCH (
    SELECTEDVALUE ( dim_funnel_stage[stage_name] ),
    "Sessions", [Total Sessions],
    "Viewed a product", [Product View Sessions],
    "Added to basket", [Basket Sessions],
    "Reached checkout", [Checkout Sessions],
    "Ordered", [Order Sessions]
)

Funnel % of Previous Stage =
VAR Stage = SELECTEDVALUE ( dim_funnel_stage[stage_order] )
VAR ThisStage = [Funnel Value]
VAR PreviousStage =
    CALCULATE ( [Funnel Value], REMOVEFILTERS ( dim_funnel_stage ), dim_funnel_stage[stage_order] = Stage - 1 )
RETURN
    IF ( Stage > 1, DIVIDE ( ThisStage, PreviousStage ) )
```

A few things worth knowing:

- **Funnel Conversion Rate % vs Digital Conversion Rate %.** They agree in total. The original measure divides orders from `fact_digital_sales` by sessions from `fact_digital_traffic`, and with no shared device dimension it can't be split by device. The funnel version is all one table, so it can.
- **The stage table.** `dim_funnel_stage` is five hand-typed rows, disconnected, with `stage_name` sorted by a hidden `stage_order`. It's the same trick as `dim_pnl_bridge`: a native funnel given five separate measures can't name or order the stages properly.
- **Reversed colours.** Add to Basket Rate, Basket Abandonment and Checkout Abandonment each have the usual LY, YoY (pp), arrow, colour and combo set. For the two abandonment measures, down is good, so the trend colour is green when they fall. The arrow still points the way the number moved.
- **What it shows.** On BY25, mobile adds to basket on about 7.8% of sessions and desktop 9.4%. Basket abandonment is around 74–77% and checkout abandonment around 43–48%. The one-page checkout launched in April 2025 takes mobile checkout abandonment from about 50% to 46% against the same weeks a year earlier.