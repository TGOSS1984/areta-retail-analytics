# Report pages

This is what each of the ten report pages shows, as built, and the numbers I'd expect to see on them. It started life as my build sheet and I've rewritten it against the exported report (`docs/screenshots/areta-retail-analytics.pdf`), so where the build drifted from the original plan, this follows the build.

All the numbers below are business year 2025 (the 2025 button), from the PDF. If you regenerate the data on a later day, BY25 shouldn't change, but BY26 will.

## How the pages are put together

Every page is 1920 x 1080 and shares one shell: the left rail (logo, page navigator, five slicers and the tagline), the header banner with `Report Last Refreshed` and the year buttons, then a row of five KPI cards across the top and two rows of visuals below.

Each KPI card is the same template: the value, an icon, one or two reference lines underneath, and a sparkline on `business_week_number`. The reference lines are the YoY or target combos, coloured with the matching Trend Colour measure (Reference label, then Font colour, then Field value). An icon means one metric everywhere, so Net Sales always has the same icon and conversion is the funnel icon for both stores and the website.

The rail slicers are the same five on every page: Week, Period, Category, Mjr Prod and Channel. They don't all reach every page. The product and channel slicers do nothing to the digital facts or the finance P&L, and nothing in the rail touches the Data Quality tables. I've parked a cleaner set (period, week and a market slicer that reaches every page through one extra relationship) to come back to.

---

## 1. Overview

*How is the business doing, and what drove it?*

| Card | Value | Reference lines |
|---|---|---|
| Net Sales | £39.00M | vs target −£87K (−0.2%), vs PY +£1.69M (+4.5%) |
| Net Units Sold | 1.12M | vs target −1.0%, vs PY +4.0% |
| Gross Margin % | 68.9% | vs target −0.2pp, vs PY +0.3pp |
| Gross Profit | £26.85M | vs PY +£1.28M (+5.0%) |
| Stock Value (Retail) | £15.27M | vs PY −1.8%, weeks of cover (last 4 weeks) 15.4 |

Top row, left to right:

- **Net Sales and Gross Margin % by business period.** Columns and a line. Margin dips in P05 and P11, the two clearance periods.
- **Net Sales vs LY by channel.** Retail £27M (up from £26M), Online £7M, Concession £5M.
- **What drove growth vs last year.** A waterfall of `Net Sales YoY (GBP)` by major product group, drilling to product group. Outerwear (+£600K) and Footwear (+£522K) lead. Camping (−£4K) and Accessories (−£40K) are the two red bars, and the total matches the +£1.69M on the Net Sales card.

Bottom row:

- **Store map** of Net Sales by latitude and longitude.
- **Net Sales by major product group**, a donut. Outerwear is a third of the business.
- **Product group table** with Net Sales and the YoY combo. Shoes is the fastest grower at +11.5%.

The waterfall replaced a best-sellers table, which was a straight copy of the one on Products. The page now says why the number moved, not just what sold.

---

## 2. Sales

*How are we trading against last year and target, and where is the growth?*

| Card | Value | Reference line |
|---|---|---|
| Net Sales | £39.00M | vs target −0.2%, vs PY +4.5% |
| Net Sales Target Achievement % | 99.8% | vs target −£87K |
| Distinct Invoices (from Sales) | 481K | vs PY +16,350 (+3.5%) |
| Average Order Value | £81.01 | vs PY +£0.80 (+1.0%) |
| Online Share % | 18.3% | vs PY +0.7pp |

The cards split the headline instead of repeating Overview: Net Sales is transactions times average order value, and Online Share shows the channel shift.

- **Net Sales vs target vs LY by business week.** The target uses `Target Net Sales (GBP), Any Grain`, which spreads each period's target over its weeks. The plain target measure draws a staircase.
- **Target variance by market.** Poland (+£90K) and Italy (+£70K) beat target; Germany is furthest behind (−£180K).
- **Trading calendar.** The Deneb heatmap of every day in the year. See [the calendar heatmap](#the-calendar-heatmap).
- **Where the growth came from.** A matrix of `Net Sales YoY %` with markets down the side and channels across, coloured red to green. Online grows in every market (+8.7% overall, +15.5% in Poland). France Retail (−3.1%) and Netherlands Concession (−2.2%) go backwards inside markets that grew overall. It sits next to the target chart on purpose: Germany is the most behind target, and here you can see its stores are flat while only Online grows.
- **Net Sales, LY, Gross Profit and LY by channel.**

Never use `Average Transaction Value (GBP)` on this page. It divides by store transactions from `fact_footfall`, so with Online in the filter it counts online sales but not online orders, and reads about £98 instead of £81. `Average Order Value (GBP)` divides by every channel's invoices. Online Share's trend colour is always grey, because a rising online share can mean stores are struggling as easily as online is thriving.

---

## 3. Products

*Which lines carry the business, and which ones come back?*

| Card | Value | Reference lines |
|---|---|---|
| Top Style | Denali Boots | £690K, 1.8% of sales |
| Average Selling Price | £34.85 | vs PY £34.67 |
| Styles for 80% of Sales % | 25.9% | of 907 styles in the range |
| Return Rate % | 2.8% | vs PY 0.0pp |
| Style-Colours Sold | 2,244 | 2.5 colours per style |

Every card is product-specific. Top Style finds the winner itself through `Top Style Net Sales (GBP)` and `Top Style Share %`, so the card has no visual filter. Two brands have a style called Denali Boots, and a filter on the name would have described both.

- **Best sellers** with product photos: style, colour, Net Sales, margin, average selling price, units, stock and weeks of cover. The Helvellyn 3 in 1 in Stone leads at £452K.
- **Style Pareto** on `style_label` (never `style_name`, which repeats across brands). About a quarter of styles make 80% of sales, and the best style sells about 49 times the median.
- **Margin vs volume** by product group: Net Sales across, Gross Margin % up, bubble size units, coloured by major group. Footwear sits low (about 66%) and Camping lowest.
- **Net Sales by season.** BY25 sells across several seasons' ranges at once, newest at the top.
- **Range analysis table** by product group: Net Sales, Gross Profit Share %, Style Productivity Index (GP) and Styles for 80% of Sales %. Softshell (index 0.69) carries more styles than it earns. 3 in 1 needs only 18% of its styles to reach 80% of its sales.

---

## 4. Categories

*How does the range mix perform, and where?*

| Card | Value | Reference lines |
|---|---|---|
| Top Product Group | Waterproof Shell | £3.47M, 8.9% of sales |
| Net Sales | £39.00M | vs PY +4.5% |
| Gross Margin % | 68.9% | vs target −0.2pp, vs PY +0.3pp |
| Gross Profit | £26.85M | vs PY +5.0% |
| Stock Value (Retail) | £15.27M | vs PY −1.8% |

- **Major product group table**, drilling to product group: Net Sales, the YoY combo and share of total. Accessories (−2.9%) and Camping (−2.7%) are the only groups down.
- **Net Sales by brand.** Areta 34.7%, Kestrel Ridge 23.1%, Basecamp 21.7%, Areta Pro 20.6%.
- **Category x market heatmap** of `Net Sales YoY %`. Footwear grows in every market, double digits in Latvia, Poland and Slovakia. Accessories falls in most of western Europe (−8.2% in Germany).
- **Range treemap**, major group then product group.
- **Net Sales and margin vs LY by gender.** Mens £12.3M, Womens £11.7M, Unisex £9.5M, Kids £5.4M.
- **Product Group Pareto.** Thirty-odd product groups, so the curve is gentler than the style one.

Use `dim_store[market_name]` for the heatmap columns, not `dim_market`. `fact_sales` only reaches markets through `dim_store`.

---

## 5. Retail

*How are the stores trading, converting and earning their space?*

The page is filtered to Retail and Concession, since Online has no footfall.

| Card | Value | Reference line |
|---|---|---|
| Total Footfall | 2.3M | vs target −59,882 (−2.6%) |
| Conversion Rate % | 17.4% | vs PY +0.1pp |
| Average Transaction Value | £80.25 | vs PY £79.50 |
| Items per Transaction | 2.35 | vs PY +0.3% |
| Sales per Sq Ft | £33.81 | vs PY +£1.19 (+3.6%) |

- **ATV and items per transaction by market.** Italy and the Netherlands have the biggest baskets; Slovakia and Czechia the smallest.
- **Net Sales vs target vs LY by store type.** High Street and Retail Park carry the estate.
- **Day of week by month** matrix of Net Sales. Saturday is the biggest day almost every month.
- **Store league table:** store, region and type, a weekly sales sparkline, Net Sales, the target combo and the YoY combo. Stores in total are up on last year (+3.6%) but 1.0% behind target.
- **Footfall YoY vs Net Sales YoY by store**, coloured by store type, with average lines making quadrants. The two move together, and the bottom-left quadrant is the list of stores losing both.

ATV and Items per Transaction divide by store transactions, which is right here because the page excludes Online.

---

## 6. Promo

*What does discounting buy us, and what does it cost in margin?*

| Card | Value | Reference line |
|---|---|---|
| Full Price Sales | £32.34M | vs PY +4.5% |
| Multi-buy Sales | £1.30M | vs PY +2.8% |
| Full Price Mix % | 82.9% | vs PY 0.0pp |
| Multi-buy Mix % | 3.3% | vs PY −0.1pp |
| Return Rate % | 2.8% | vs PY 0.0pp |

- **Net Sales by promotion type.** Full price 82.9%, seasonal sales 8.5%, multi-buy 3.3%, clearance 3.0%, flash events 2.3%.
- **The cost of discounting:** Net Sales and Gross Margin % by discount band. Margin falls from 70.6% at full price to 53.6% at 51–70% off. Multi-buys (60.6%) cost less margin than a 31–50% markdown.
- **Return rate vs LY by quarter.**
- **Full price and multi-buy sales by business period.**
- **Promotion table:** every promotion with its type, discount, dates, Net Sales, share, units, margin and invoices. Summer Sale 2025 was the biggest at £989K, and socks 3 for 2 sold the most units of any multi-buy.

Returns are all coded `PROMO0000`, whatever the original sale was on, so Full Price carries every refund in the business (about £1.27M in BY25). The real full price mix is slightly higher than the card says.

---

## 7. Digital

*How is the website trading and converting, and where do shoppers drop out?*

| Card | Value | Reference lines |
|---|---|---|
| Digital Net Sales | £7.36M | vs target +£266K (+3.7%), vs PY +£586K (+8.6%) |
| Total Sessions | 4.21M | vs PY −0.1% |
| Digital Conversion Rate % | 2.0% | vs PY +0.1pp |
| Average Basket Value | £87.25 | vs PY +£1 (+0.9%) |
| Basket Abandonment % | 76.0% | vs PY −1.3pp |

The cards tell one story: sales are sessions times conversion times basket, and in BY25 traffic was flat, conversion and basket rose, and sales grew 8.6%. That's the April 2025 one-page checkout, and Basket Abandonment shows it directly. Its trend colour is reversed: green when it falls.

- **Average basket by device.** Desktop £117, Tablet £108, Mobile £69.
- **Digital sales vs target by market.**
- **Browsers table** with logos: sessions, pages per session and `Funnel Conversion Rate %`. Edge converts best (2.2%).
- **Sessions by device.** Two thirds of sessions are on mobile.
- **Shopping funnel:** 4.21M sessions, 2.32M viewed a product, 351K added to basket, 155K reached checkout, 84K ordered. Category `dim_funnel_stage[stage_name]`, values `Funnel Value`, tooltip `Funnel % of Previous Stage`.
- **Digital sales and conversion by week.** Conversion steps up in April, when the new checkout lands.

`Digital Conversion Rate %` can't split by device, because orders and sessions sit on different tables. `Funnel Conversion Rate %` comes entirely from the traffic table, so it can, and the two agree in total. Use `dim_market` on this page, not `dim_store`: the digital facts don't go through stores.

---

## 8. Finance

*Where does the money go between turnover and net contribution, and which stores earn their keep?*

| Card | Value | Reference line |
|---|---|---|
| Turnover | £31.86M | none |
| Gross Contribution % | 23.4% | vs PY +1.8pp |
| Net Contribution | £5.86M | vs target −£475K (−7.5%) |
| Net Contribution % | 18.4% | vs PY +1.8pp |
| Store Operating Costs | £14.50M | vs PY +£47K (+0.3%) |

Turnover is Retail and Concession only, about 82% of company sales, because Online has no rent or staff lines to bridge. It's labelled Turnover rather than Net Sales so nobody puts it next to the Sales page and thinks one of them is wrong.

- **Net Contribution % vs Sales per Sq Ft by store**, coloured by market. Most stores sit between 0% and 40%; a handful of big footprints trade thinly and lose money.
- **Turnover, margin and net contribution by market.** The UK is over a third of store turnover.
- **P&L bridge.** A waterfall from turnover down through marketing, head office, utilities, staff, rent and cost of goods to net contribution, from `dim_pnl_bridge` and `P&L Bridge Value`. It reconciles exactly to the Net Contribution card.
- **Net Contribution % by business period.** From 5.6% in P02 to 31.0% in P09, because the costs are fixed and sales aren't.
- **Store cost mix.** Rent £6.18M, staff £5.99M, utilities £1.79M, marketing £0.54M.

Everything here is business period grain, so keep axes on `business_period_label`, never week. The YoY references needed a model fix after the first export, where they all read 0.0 (see open items).

---

## 9. Stock

*Have we got the right stock in the right place for how fast it sells?*

| Card | Value | Reference lines |
|---|---|---|
| Stock Units | 289K | vs PY −1.6% |
| Stock Value (Retail) | £15.27M | vs PY −1.8% |
| Stock Value (Cost) | £5.03M | vs PY −1.8% |
| Weeks of Cover (Last 4 Weeks) | 15.4 | 13.1 on the whole-year rate, 13.8 last year |
| Avg Weekly Sales (Units) | 22.1K | vs PY +4.0% |

Stock is a weekly closing balance, so every stock measure takes the last snapshot in the filter. For BY25 that's 28 February 2026, after the winter season.

- **Weeks of cover by product group.** Softshell is the outlier at 39 weeks; 3 in 1 is next at 29.
- **Stock vs rate of sale** by product group, bubble size stock value, with average lines. The big bubble high up on the left is stock that isn't moving.
- **Stock by market:** value, change on last year and weeks of cover. Germany carries the most cover (15.7 weeks), Latvia the least (8.6).
- **Stock mix vs sales mix** by major group. Outerwear holds 43% of the stock value for 34% of the sales; Tops and Accessories run lean.
- **Stock value and cover by major group.** Accessories turn fastest; Camping has the most cover for the least value.

Weeks of Cover means different things at different grains, because it's closing stock divided by the average weekly rate over whatever window is selected. A week is volatile, a period is the everyday view, and a year blends peak and quiet weeks. `Weeks of Cover (Last 4 Weeks)` uses the rate in the four weeks up to the closing date instead, which is how a merchandiser would quote it, so that's the one on the card.

I started this page with a stock value trend over time, but the generator's stock has no seasonal build, so the line sat flat at about £15M. The mix comparison works with the data as it is.

---

## 10. Data Quality

*Can I trust the numbers on the other nine pages?*

| Card | Value |
|---|---|
| Data Quality Score | 97.4% (74 of 76 checks) |
| DQ Overall Status | 2 warnings |
| DQ Scored Rows Tested | 85M |
| DQ Latest Data Date | the day the pipeline last ran |
| DQ Rows Fixed in Cleaning | 346K |

- **Checks by status.**
- **What cleaning fixed:** 140K blank discounts set to 0%, 117K lowercase store IDs, 78K currency codes with stray spaces, 12K duplicate lines.
- **Where the problems sit.** A matrix of `Data Quality Score` by table and check category, with rules colouring. Its column totals are the score by category.
- **All check results**, warnings first.
- **Table profile and freshness.**
- **Reconciliation:** each pair of sources that should agree, side by side.

The exported PDF still shows the audit from before the digital funnel (95.9%, 74 checks, a VAL-19 warning), because the DQ tables hadn't been refreshed in Desktop. A full refresh brings it up to the numbers above. The detail is in `docs/data-quality-page.md`.

---

## Open items on the report

Things I noticed going through the export, roughly in order of importance:

1. **Refresh all before the next export.** The Data Quality page is a refresh behind (see above).
2. **Finance YoY.** Gross Contribution %, Net Contribution % and Store Operating Costs all read 0.0 against last year. The finance LY measures filtered `dim_period[business_year]`, but the year buttons filter `dim_date`, so that filter survived and LY came back equal to this year. Fixed in the model in the same commit as this doc. After a refresh they should read +1.8pp, +1.8pp and +£47K.
3. **Visual titles.** Most are still Power BI's automatic ones ("Net Sales (GBP) by major_product_group"). They need plain English titles like the KPI cards have.
4. **Two reference lines show last year's value instead of the change**: Average Selling Price on Products (£34.67) and Average Transaction Value on Retail (£79.50). Swap them to the YoY combos.
5. **Rounded card values.** Net Units Sold reads "1M" and Style-Colours Sold "2K". Turn display units off or allow two decimals so they read 1.12M and 2,244.
6. **Repeated cards.** Categories repeats four of Overview's five cards, and Return Rate is on both Products and Promo. Categories would be stronger with category-specific cards.
7. **Shared icons.** Top Style and Top Product Group both use the trophy, and Average Basket Value and Multi-buy Sales both use the basket.
8. **Cost mix donut.** The centre label shows staff costs (£5.99M), not total operating costs (£14.50M).
9. **Sales, bottom right.** The Net Sales and Gross Profit by channel chart repeats Overview's channel bar and the Online Share card. Net Sales by weekday against LY would be new.
10. **VAT and currency toggles** aren't on the pages yet. The model supports both through the `VAT View` and `Currency Conversion` calculation groups.
11. **Rail slicers.** See the note at the top: Category, Mjr Prod and Channel don't reach Digital, Finance's P&L or Data Quality.

---

## The heatmaps

### The calendar heatmap

This is on the Sales page. The spec is `powerbi/deneb/deneb-calendar-heatmap.json`. It shows every trading day of the latest business year in the filter as a 52-week by 7-day grid, darker for bigger days. Christmas Day, Boxing Day and Black Friday get a gold outline.

Values well, all from `dim_date` plus the measure:

- `full_date`
- `day_name`
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

The growth matrix on Sales, the category x market heatmap on Categories and the problem matrix on Data Quality are ordinary matrix visuals with background colour turned on. They're built the same way:

1. Add a Matrix with the rows, columns and value from the page table.
2. Decide on subtotals. Sales keeps both, so the totals give each channel and each market overall. Categories turns them off. Data Quality keeps column subtotals, since they're the score by category.
3. Under Cell elements, pick the value series and turn Background colour on.
   - **Diverging (Sales and Categories YoY):** Gradient, tick "Add a middle colour". Set Minimum to Number -0.2 with `#D32F2F`, Center to Number 0 with `#F5F1EA`, and Maximum to Number 0.2 with `#2E7D32`. Fixed numbers stop a single outlier from flattening everything else.
   - **Rules (Data Quality):** Format style Rules on `Data Quality Score`. If value is 1 then `#2E7D32`. If value is 0.9 or more and below 1 then `#F9A825`. If value is below 0.9 then `#D32F2F`. Blank cells stay blank, which matters because most tables don't have a check in every category.
4. Under Grid, set white horizontal and vertical gridlines at 2px so the cells separate.
5. Turn off auto-size column width and set every column to the same width, so the cells come out square-ish.
6. To make it a pure heatmap with no numbers, set Font colour to the same rule as the background. I've kept the numbers on all three.

`day_name` already sorts by `day_of_week_num`, and `business_period_label` by `period_key`, so the rows and columns come out in the right order without any extra work.

---

## Building a Deneb visual

The two specs in `powerbi/deneb/` follow the same steps:

1. Add Deneb from Get more visuals and drop it on the page.
2. Fill the Values well. If a date goes in as a Date Hierarchy, change it to the plain column from the field's dropdown, or the spec won't find it. Number columns that default to Sum (`business_year`, `business_week_number`) need Don't summarize, or they arrive renamed as "Sum of …".
3. Click "…", then Edit, choose Vega-Lite and an empty template, and paste the spec over it.
4. Apply with Ctrl+Enter, then go back to the report.

Field names in the well have to match the spec exactly, case included. A blank visual is nearly always a field name that doesn't match.