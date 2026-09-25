# Data quality page

I wanted the report to prove the data can be trusted, not just claim it. The page reads from an audit that runs at the end of the generator pipeline, so it refreshes with the data every week and describes the tables it sits next to.

## How it fits together

1. `generator/quality/build_data_quality.py` audits the finished warehouse and writes two small tables to `data/warehouse/`.
2. `weekly_refresh.py` runs it as the last step, after the web exports, so it can also check the web export against the warehouse. A failing check never stops the run (it shows up on the page instead). The audit only stops the run if it can't execute at all.
3. Power BI loads the two tables with **no relationships**. I kept them disconnected on purpose: the relationship graph is fragile and these tables have nothing to filter.
4. The measures live in a `Data Quality` display folder on those two tables.

To run just the audit: `python generator/quality/build_data_quality.py` (about 30 seconds). Add `--strict` to exit non-zero if any Critical check fails.

## The two tables

**`dq_check_results`** has one row per check.

| Field | What it holds |
|---|---|
| `check_id`, `check_name`, `check_description` | e.g. `REC-02`, and what the check actually tests |
| `category` | Integrity, Uniqueness, Validity, Completeness, Reconciliation, Freshness, Cleaning |
| `table_name` | the table being checked |
| `severity` | `Critical` (any failing row = Fail) or `Advisory` (Warn) |
| `rows_tested`, `rows_failed` | how many rows were checked and how many broke the rule |
| `status` | Pass, Warn, Fail, or Fixed (Cleaning rows only) |
| `counts_toward_score` | 1 for the 74 scored checks, 0 for the Cleaning rows |
| `source_a_label/value`, `source_b_label/value`, `variance` | the two sides of a reconciliation |
| `run_timestamp` | when the audit ran, in UTC |

**`dq_table_profile`** has one row per warehouse table: row count, column count, null cells, the earliest and latest date for the tables with actuals, days behind the run date, and Fresh / Stale.

## What the checks cover

78 checks in total: 15 Integrity, 12 Uniqueness, 23 Validity, 13 Completeness, 6 Reconciliation, 5 Freshness and 4 Cleaning.

The reconciliations compare like with like. Digital sales, footfall transactions and footfall units tie to sales **before returns**, because returns only exist as lines in `fact_sales`. That means Online net sales including returns is about £0.84M lower than Digital Net Sales. Neither number is wrong, but the page carries a footnote so nobody trips over it.

Results from my run on 20 Sep 2026: 74 scored checks, 71 passed, 3 warnings, 0 failed.

| Warning | What it is |
|---|---|
| `VAL-19` Sessions at least visitors | 43 of 213,840 traffic rows have fewer sessions than visitors. A rounding artefact in the simulation. |
| `CMP-11` Every SKU has sold | 4 of 12,151 SKUs never sold. |
| `CMP-13` Store-days with visitors have sales | 20,581 of 453,600 store-days had visitors but no transactions. |

The Cleaning rows show what `clean_fact_sales.py` fixed in the raw file, out of 3,948,592 raw lines: 11,810 duplicates dropped, 118,458 lowercase store IDs corrected, 78,972 currency codes stripped of whitespace and 153,912 blank discounts set to 0%.

The 1,064 null cells in the profile are by design. `fact_targets` has no footfall or contribution target for Online (1,056), and `dim_promo` has no date window or discount for the base and multi-buy promotions (8).

## Build sheet

The page is 1920 x 1080 and uses the same shell as the rest of the report: the 211px left rail, the 84px header, the page navigator and the `Report Last Refreshed` card. Page icon is `shield-check`. The shell was copied from Sales, so clear it first:

- Delete the Net Sales card and its sparkline.
- Delete the `business_year` slicer and the five rail slicers (week, month, product_group, major_product_group, channel). The DQ tables have no relationships, so none of those slicers filter anything here. They'd only suggest that they do.
- Leave the VAT and currency slicers off this page (don't sync them here).

| # | Visual | Type | x | y | w | h |
|---|---|---|---|---|---|---|
| 1 | Category filter | Slicer, vertical tile, in the rail | 19 | 619 | 160 | 300 |
| 2 | Five KPI cards (below) | Card (new) | 227 | 94 | 324 each | 162 |
| 3 | Checks by status | Donut | 227 | 268 | 400 | 400 |
| 4 | What cleaning fixed | Bar | 639 | 268 | 600 | 400 |
| 5 | Where the problems sit | Matrix heatmap | 1251 | 268 | 650 | 400 |
| 6 | All check results | Table | 227 | 680 | 1107 | 390 |
| 7 | Reconciliation | Table | 1346 | 680 | 555 | 190 |
| 8 | Table profile and freshness | Table | 1346 | 880 | 555 | 190 |

The KPI cards sit at x = 227, 570, 903, 1241 and 1577, which is the same grid as every other page.

**Slicer:** `dq_check_results[category]`. Sorts by `category_order` automatically.

**KPI cards**

| Card | Value | Subtitle / reference label | Colour |
|---|---|---|---|
| Data Quality Score | `Data Quality Score` | `DQ Checks Passed Label` | value font: Field value, `DQ Overall Status Colour` |
| Status | `DQ Overall Status` | | font: Field value, `DQ Overall Status Colour` |
| Rows tested | `DQ Scored Rows Tested` | | none |
| Latest data | `DQ Latest Data Date` | `DQ Freshness Summary` | subtitle: Field value, `DQ Freshness Overall Colour` |
| Fixed in cleaning | `DQ Rows Fixed in Cleaning` | `DQ Raw Rows Received` | none |

**3. Donut:**
- Legend `dq_check_results[status]`, values `DQ Checks Run`.
- Set the slice colours by hand: Pass `#2E7D32`, Warn `#F9A825`, Fail `#D32F2F`.
- Use `DQ Checks Run` here, not `DQ Checks Passed`. The passed/warned/failed measures set their own status filter and would ignore the legend.

**4. Cleaning bar:**
- Visual filter: `category` is `Cleaning`.
- Axis `check_name`, value `DQ Rows Failed`, one colour (`#0288D1`).

**5. Heatmap:**
- Matrix with rows `table_name`, columns `category`, values `Data Quality Score`.
- Turn row subtotals off and column subtotals on. The column totals are the score by category, which is why this replaced the separate score-by-category bar.
- Cell elements > Background colour > Format style Rules on `Data Quality Score`: value is 1 then `#2E7D32`, 0.9 or more and below 1 then `#F9A825`, below 0.9 then `#D32F2F`.
- White font, white 2px gridlines, fixed equal column widths.
- Blank cells mean that table has no check in that category, so they stay uncoloured. The Cleaning column drops out by itself because it has no scored checks.

**6. Check results:**
- Columns `check_id`, `category`, `table_name`, `check_name`, `DQ Rows Tested`, `DQ Rows Failed`, `DQ Row Pass Rate %`, `status`.
- Sort by `status` ascending so Fail and Warn come first.
- The width fits `check_description` as a last column if you want the explanation inline.

**7. Reconciliation:**
- Visual filter: `category` is `Reconciliation`.
- Columns `check_name`, `DQ Source A Value`, `DQ Source B Value`, `DQ Recon Variance`, `status`.
- Put the footnote below in this visual's subtitle, so it sits right next to the numbers it explains.

**8. Table profile:**
- Columns `table_name`, `table_type`, `DQ Total Rows`, `DQ Null %`, `latest_data_date`, `DQ Days Behind`, `freshness_status`.

**Status colours in the tables:** on the `status` column in 6 and 7, set Cell elements > Background colour > Format style: Field value > `DQ Status Colour`, with white font. Do the same on `freshness_status` in 8 with `DQ Freshness Colour`.

**Footnote** (subtitle of visual 7): *Digital sales, footfall transactions and footfall units reconcile to sales before returns. Returns exist only as lines in fact_sales, so Online net sales including returns is lower than Digital Net Sales by the value of the returns. Audit times are UTC.*

## Numbers to check against

From my 25 Sep 2026 run, after the style popularity and key trading day changes to the generator. If you regenerate on a later day the data runs up to that day, so the row counts and dates will move.

| Measure | Should show |
|---|---|
| Data Quality Score | 95.9% (71 of 74 checks passed) |
| DQ Overall Status | 3 warnings |
| DQ Scored Rows Tested | 84,398,281 |
| DQ Latest Data Date | 25 Sep 2026 |
| DQ Rows Fixed in Cleaning | 358,686 (of 3,912,282 raw lines) |
| DQ Tables Profiled / DQ Total Rows | 15 / 11,463,131 |
| DQ Null % | 0.001% |
| Score by category | Completeness 84.6%, Validity 95.7%, everything else 100% |