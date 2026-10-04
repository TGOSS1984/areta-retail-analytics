# Data dictionary

Every table in `data/warehouse/`, what one row is, and what each column means. These are the Parquet files the generator writes and Power BI, the SQL suite and the web app all read. Row counts move a little each time the pipeline runs, because the data is generated up to the current date, so I've left them out.

Money is in GBP unless the column says otherwise. Every date is a plain date with no time.

## Dimensions

### dim_date

One row per day, from 5 March 2023 to the end of the current business year. The business year starts in early March and is 364 days long: twelve periods of four or five weeks, Sunday to Saturday.

| Column | Type | Description |
|---|---|---|
| `date_key` | integer | The date as a number, `YYYYMMDD` |
| `full_date` | date | The date. The key the daily facts join on |
| `day_name` | text | Sunday to Saturday |
| `day_of_week_num` | integer | 1 (Sunday) to 7 (Saturday), the retail week. `day_name` sorts by it |
| `is_weekend` | boolean | Saturday or Sunday |
| `day_of_month`, `month_num`, `month_name` | integer, integer, text | The calendar month parts |
| `calendar_quarter`, `calendar_year`, `calendar_week_number` | integer | The calendar (January to December) parts |
| `season`, `season_label` | text | SS or AW, and the season with its year (`SS23`, `AW25`). The selling season the day falls in |
| `business_year` | integer | The business year, named after the calendar year it starts in. BY25 runs from March 2025 to February 2026 |
| `business_week_number` | integer | 1 to 52 within the business year |
| `business_period_number` | integer | 1 to 12 within the business year |
| `business_period_label` | text | `BY25 P03` style label. Sorts by `period_key` |
| `business_quarter` | integer | 1 to 4 within the business year |
| `period_key` | integer | `business_year * 100 + period`, for example 202503. Unique per period |
| `is_business_year_start` | boolean | The first day of a business year |
| `is_new_years_day`, `is_christmas_day`, `is_boxing_day`, `is_black_friday` | boolean | The key trading days. The sales generator uses them: stores shut on Christmas Day, Black Friday trades at about twice a normal Friday |

### dim_period

One row per business period, 48 in all. Targets and store finance are stored at this grain.

| Column | Type | Description |
|---|---|---|
| `period_key` | integer | The key, as in `dim_date` |
| `business_year`, `business_period_number`, `business_period_label`, `business_quarter` | | As in `dim_date` |
| `period_start_date`, `period_end_date` | date | The Sunday the period starts and the Saturday it ends |

### dim_store

One row per store, 361 in all: 202 retail stores, 148 concessions inside other retailers, and 11 online stores (one per market).

| Column | Type | Description |
|---|---|---|
| `store_id` | text | `ST0001` and so on |
| `store_name` | text | "Areta Leeds". Towns with more than one store get a number in brackets |
| `channel` | text | Retail, Concession or Online |
| `store_type` | text | High Street, Retail Park, Shopping Centre, Outlet, Garden Centre or Department Store. Online for the online stores |
| `square_footage` | integer | Selling space. 0 for the online stores, so Sales per Sq Ft is blank for them |
| `market_code`, `market_name` | text | The country: UK, IE, DE, NL, FR, IT, PL, CZ, SK, LV, LT |
| `city`, `region` | text | Where the store is. Regions are within each market |
| `latitude`, `longitude` | decimal | For the maps |
| `currency` | text | The currency the store trades in: GBP, EUR, PLN or CZK |
| `is_home_market` | boolean | True for the UK |

### dim_product

One row per SKU, 12,151 in all: 907 styles in 2,251 colourways, across their sizes.

| Column | Type | Description |
|---|---|---|
| `sku` | text | Style, colour and size, for example `ARETA00001-BLK-XS` |
| `style_code` | text | The style, for example `ARETA00001` |
| `style_name` | text | "Helvellyn Waterproof Shell". Not unique: 907 styles share 498 names across the brands |
| `brand_code`, `brand_name` | text | Areta, Areta Pro, Kestrel Ridge or Basecamp |
| `brand_tier` | text | Flagship (Areta), Technical (Kestrel Ridge), Value (Basecamp) or Workwear (Areta Pro) |
| `sub_brand` | text | A line within the brand |
| `division` | text | Apparel & Other, Footwear, or Camping & Equipment |
| `major_product_group` | text | Outerwear, Footwear, Midlayer, Legwear, Tops, Accessories, Camping & Equipment |
| `product_group` | text | 33 groups, from Waterproof Shell to Sleeping Bags. Socks, Softshell and Gilets appear under two major groups each |
| `gender` | text | Mens, Womens, Unisex or Kids |
| `season_label` | text | The season the style launched in |
| `colour`, `colour_code` | text | "Black" and `BLK` |
| `style_colour_code` | text | Style and colour, for example `ARETA00001-BLK`. The key for anything at style-colour level |
| `style_colour_label` | text | Name, colour and code, for axes and cards that need to read as a name without merging two products |
| `size_code`, `size_description` | text | `XS` and "Extra Small". Shoes use UK sizes |
| `base_price_gbp` | decimal | Full retail price |
| `cost_price_gbp` | decimal | What the product costs to buy |
| `image_file` | text | The photo or placeholder used for the style and colour, relative to `web/public/images/` |
| `image_source` | text | Where `image_file` came from: a product photo, or the product group, major group or default placeholder |

### dim_promo

One row per promotion, plus `PROMO0000` for full price and one row for each multi-buy scheme.

| Column | Type | Description |
|---|---|---|
| `promo_id` | text | `PROMO0000` is full price. Multi-buys start `MULTIBUY-` |
| `promo_name` | text | "Summer Sale 2025", "Socks 3 for 2" |
| `promo_type` | text | None, Seasonal Sale, Clearance, Flash Event or Multi-buy |
| `start_date`, `end_date` | date | When it ran. Blank for full price and the multi-buys, which run on a monthly pattern rather than fixed dates |
| `discount_pct` | decimal | The headline discount. Blank for multi-buys, where the saving depends on the basket |

### dim_currency

| Column | Type | Description |
|---|---|---|
| `currency_code` | text | GBP, EUR, PLN, CZK |
| `currency_name`, `symbol` | text | "Czech Koruna", "Kč" |
| `decimal_places` | integer | For formatting |
| `is_reporting_currency` | boolean | True for GBP, the currency everything is reported in |

## Facts

### fact_sales

One row per invoice line: a store, a day, an invoice and a SKU. Returns are separate lines with negative quantity and values. About 3.9 million rows.

| Column | Type | Description |
|---|---|---|
| `date` | date | Trading day |
| `store_id` | text | The store, including the online stores |
| `invoice_id` | text | The transaction, for example `INV20230305-ST0001-002`. Several lines share one invoice |
| `line_number` | integer | The line within the invoice |
| `sku` | text | What was sold |
| `quantity` | integer | Units. Negative on a return |
| `promo_id` | text | The promotion the line sold on. Every return is `PROMO0000` |
| `discount_pct` | integer | The discount on the line |
| `unit_price_gbp` | decimal | Price per unit after discount, ex-VAT |
| `net_sales_gbp` | decimal | Sales value ex-VAT, after discount. The number behind Net Sales everywhere |
| `vat_gbp`, `gross_sales_gbp` | decimal | The VAT, and the value including it, at the market's VAT rate |
| `net_sales_local`, `currency` | decimal, text | Net sales in the store's own currency |
| `cost_gbp` | decimal | Cost of the units. Net sales minus cost is gross profit |
| `is_return` | boolean | True on a return line |

### fact_footfall

One row per physical store per day. Online stores have no footfall.

| Column | Type | Description |
|---|---|---|
| `date`, `store_id` | | |
| `footfall` | integer | People through the door |
| `transactions` | integer | Invoices that day, counted from `fact_sales` (REC-04 checks they agree) |
| `units_sold` | integer | Units sold, before returns, also from `fact_sales` |
| `conversion_rate` | decimal | Transactions over footfall |

### fact_stock_snapshot

One row per store, style and colour, every Saturday. Stock is a closing balance, so never add weeks together.

| Column | Type | Description |
|---|---|---|
| `week_ending_date` | date | The Saturday the snapshot was taken |
| `store_id`, `style_code`, `colour` | text | Store and style-colour. There's no size: stock is held at style-colour level |
| `brand_code`, `division`, `major_product_group`, `product_group` | text | Copied on for convenience. Hidden in Power BI, where product filters come from `dim_product` instead |
| `stock_units` | integer | Units on hand |
| `stock_value_cost_gbp`, `stock_value_retail_gbp` | decimal | The stock at cost and at full retail price |

### fact_targets

One row per store per business period.

| Column | Type | Description |
|---|---|---|
| `store_id`, `business_year`, `business_period_number`, `period_key` | | |
| `target_net_sales_gbp`, `target_net_units_sold` | decimal | Sales and unit targets, built from last year plus growth |
| `target_gross_margin_pct`, `target_gross_profit_gbp` | decimal | Margin targets |
| `target_footfall` | decimal | Blank for online stores |
| `target_net_contribution_gbp` | decimal | Blank for online stores |

### fact_store_finance

One row per physical store per business period: a simple store P&L.

| Column | Type | Description |
|---|---|---|
| `store_id`, `business_year`, `business_period_number`, `period_key` | | |
| `net_sales_gbp` | decimal | The store's net sales for the period. Reconciles to `fact_sales` (REC-01). Shown as Turnover on the report |
| `cogs_gbp`, `gross_profit_gbp` | decimal | Cost of goods and gross profit |
| `rent_gbp`, `staff_gbp`, `utilities_gbp`, `marketing_gbp` | decimal | The store's operating costs |
| `gross_contribution_gbp`, `gross_contribution_pct` | decimal | Gross profit minus operating costs, and as a share of net sales |
| `head_office_gbp` | decimal | The store's share of head office costs |
| `net_contribution_gbp`, `net_contribution_pct` | decimal | Gross contribution minus head office, and as a share of net sales. Can be negative |

### fact_digital_sales

One row per market, device and day for the online stores.

| Column | Type | Description |
|---|---|---|
| `date`, `market_code` | | |
| `device_type` | text | Desktop, Mobile or Tablet |
| `orders`, `units` | integer | Online orders and units, before returns |
| `net_sales_gbp` | decimal | Online sales before returns (REC-02 checks it against `fact_sales`) |
| `basket_value_gbp` | decimal | Net sales per order |

### fact_digital_traffic

One row per market, device, browser and day.

| Column | Type | Description |
|---|---|---|
| `date`, `market_code`, `device_type` | | |
| `browser` | text | Chrome, Safari, Edge, Firefox or Other |
| `visitors`, `sessions`, `page_views` | integer | Traffic |
| `product_view_sessions` | integer | Sessions that viewed at least one product |
| `basket_sessions` | integer | Sessions that added something to the basket |
| `checkout_sessions` | integer | Sessions that reached checkout |
| `order_sessions` | integer | Sessions that ordered. Adds up to `fact_digital_sales` orders (REC-07) |

Each funnel stage is a count of sessions that got at least that far, so they only narrow (VAL-24).

### fact_digital_targets

One row per market per business period.

| Column | Type | Description |
|---|---|---|
| `market_code`, `business_year`, `business_period_number`, `period_key` | | |
| `target_digital_net_sales_gbp` | decimal | The online sales target |

### fx_rate_monthly

One row per currency per month.

| Column | Type | Description |
|---|---|---|
| `month_start` | date | The first of the month |
| `currency_code` | text | |
| `gbp_rate` | decimal | Units of the currency per £1 that month. GBP is 1 |

## Data quality

Written by the audit at the end of every run. They describe the other tables rather than joining to them. The page that reads them is described in `docs/data-quality-page.md`.

### dq_check_results

One row per check, 80 in all.

| Column | Type | Description |
|---|---|---|
| `check_id` | text | `INT-01`, `VAL-24`, `REC-07` and so on. The prefix is the category |
| `category`, `category_order` | text, integer | Integrity, Uniqueness, Validity, Completeness, Reconciliation, Freshness or Cleaning, and their display order |
| `table_name`, `check_name`, `check_description` | text | What was checked, in plain words |
| `severity` | text | Critical, Advisory for the checks that warn rather than fail, or Info for the Cleaning rows |
| `rows_tested`, `rows_failed` | integer | |
| `status`, `status_order` | text, integer | Pass, Warn, Fail or Fixed, and the order that puts failures first |
| `counts_toward_score` | integer | 1 for the 76 scored checks. The Cleaning rows record what was fixed, so they don't count |
| `source_a_label`, `source_a_value`, `source_b_label`, `source_b_value`, `variance` | | Reconciliation checks only: the two figures that should agree, and the gap |
| `run_timestamp` | text | When the audit ran |

### dq_table_profile

One row per warehouse table.

| Column | Type | Description |
|---|---|---|
| `table_name`, `table_type`, `grain` | text | The table, Dimension or Fact, and what one row is |
| `row_count`, `column_count`, `cell_count`, `null_cells` | integer | Size and completeness |
| `earliest_data_date`, `latest_data_date` | date | The range of dates in the table, for facts |
| `run_date` | date | The day the audit ran |
| `days_behind_run`, `allowed_lag_days`, `freshness_status` | | How far the latest date is behind the run, how far it's allowed to be, and whether that's OK. Stock is allowed to lag to the last Saturday |