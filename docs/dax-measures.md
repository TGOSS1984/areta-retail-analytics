# Power BI model reference

Written for pasting into Power BI Desktop, not run or tested there myself —
I don't have access to it. Standard, well-established DAX patterns
throughout, but flag anything that errors and I'll fix it.

## Relationships

All single-direction, many-to-one from fact to dimension unless noted.

| From | To | Notes |
|---|---|---|
| `fact_sales[date]` | `dim_date[full_date]` | |
| `fact_sales[store_id]` | `dim_store[store_id]` | |
| `fact_sales[sku]` | `dim_product[sku]` | |
| `fact_sales[promo_id]` | `dim_promo[promo_id]` | |
| `fact_sales[currency]` | `dim_currency[currency_code]` | |
| `fact_footfall[date]` | `dim_date[full_date]` | |
| `fact_footfall[store_id]` | `dim_store[store_id]` | |
| `fact_targets[store_id]` | `dim_store[store_id]` | |
| `fact_targets[period_key]` | `dim_date[period_key]` | Not `retail_year`/`retail_period_number` directly — Power BI relationships are single-column, this is the key built for exactly that. |
| `fact_stock_snapshot[week_ending_date]` | `dim_date[full_date]` | |
| `fact_stock_snapshot[store_id]` | `dim_store[store_id]` | |

**`fact_stock_snapshot` does NOT relate to `dim_product`.** It's at style+colour grain, one level up from dim_product's SKU grain — brand/division/product_group are already denormalised directly onto the fact table for this reason. Don't try to build this relationship, it won't resolve cleanly.

**`fx_rate_monthly` is left unrelated for now.** `fact_sales` already carries both `net_sales_gbp` and `net_sales_local` precomputed, so nothing needs to look up a rate at query time. Only relate it (on `currency_code`, plus a month-level date relationship) if you specifically want an FX-rate trend visual.

Mark `dim_date` as the date table (`full_date` as the key) even though the YoY measures below use explicit `retail_year` filtering rather than Power BI's built-in time intelligence — our retail year is a fixed 364-day block, not a Gregorian year, so `SAMEPERIODLASTYEAR` would give the wrong answer.

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
```

Add this one as a **calculated column** on `fact_sales`, not a measure — it buckets a row-level field, doesn't aggregate one:

```dax
Discount Band =
SWITCH (
    TRUE (),
    fact_sales[discount_pct] = 0, "Full Price",
    fact_sales[discount_pct] <= 30, "Up to 30% off",
    fact_sales[discount_pct] <= 50, "31-50% off",
    fact_sales[discount_pct] <= 70, "51-70% off",
    "70%+ off"
)
```

### Time intelligence (retail-calendar aware)

```dax
Net Sales LY =
CALCULATE (
    [Net Sales (GBP)],
    FILTER ( ALL ( dim_date ), dim_date[retail_year] = MAX ( dim_date[retail_year] ) - 1 )
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

### Stock

```dax
Stock Units =
SUM ( fact_stock_snapshot[stock_units] )

Stock Value (Cost, GBP) =
SUM ( fact_stock_snapshot[stock_value_cost_gbp] )

Stock Value (Retail, GBP) =
SUM ( fact_stock_snapshot[stock_value_retail_gbp] )

Avg Weekly Sales (Units) =
DIVIDE ( [Gross Units Sold], DISTINCTCOUNT ( dim_date[retail_week_number] ) )

Weeks of Cover =
DIVIDE ( [Stock Units], [Avg Weekly Sales (Units)] )
```

`Weeks of Cover` only makes sense filtered to the latest stock snapshot week, not summed across every week in the table — pair it with a "latest week" filter or slicer, not a plain matrix spanning the whole date range.

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