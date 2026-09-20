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

Canvas 1280 x 720, same header and nav buttons as the other pages. Page icon is `shield-check`. The positions below assume a 64px header, so shift everything down if yours is taller.

| # | Visual | Type | x | y | w | h |
|---|---|---|---|---|---|---|
| 1 | Category filter | Slicer, tile style | 20 | 64 | 620 | 40 |
| 2 | Five KPI cards (below) | Card (new) | 20 | 112 | 236 each | 92 |
| 3 | Checks by status | Donut | 20 | 216 | 190 | 190 |
| 4 | Score by category | Bar | 222 | 216 | 418 | 190 |
| 5 | Reconciliation | Table | 20 | 418 | 620 | 136 |
| 6 | Table profile and freshness | Table | 20 | 566 | 620 | 134 |
| 7 | All check results | Table | 652 | 216 | 596 | 300 |
| 8 | What cleaning fixed | Bar | 652 | 528 | 596 | 172 |

The KPI cards sit at x = 20, 268, 516, 764 and 1012.

**Slicer:** `dq_check_results[category]`. Sorts by `category_order` automatically.

**KPI cards**

| Card | Value | Subtitle / reference label | Colour |
|---|---|---|---|
| Data Quality Score | `Data Quality Score` | `DQ Checks Passed Label` | value font: Field value, `DQ Overall Status Colour` |
| Status | `DQ Overall Status` | | font: Field value, `DQ Overall Status Colour` |
| Rows tested | `DQ Scored Rows Tested` | | none |
| Latest data | `DQ Latest Data Date` | `DQ Freshness Summary` | subtitle: Field value, `DQ Freshness Overall Colour` |
| Fixed in cleaning | `DQ Rows Fixed in Cleaning` | `DQ Raw Rows Received` | none |

**3. Donut:** legend `dq_check_results[status]`, values `DQ Checks Run`. Set the slice colours by hand: Pass `#2E7D32`, Warn `#F9A825`, Fail `#D32F2F`. Use `DQ Checks Run` here and not `DQ Checks Passed`, because the passed/warned/failed measures set their own status filter and would ignore the legend.

**4. Score by category:** axis `category`, value `Data Quality Score`, axis 0 to 100%, data labels on. Cleaning drops out on its own because it has no scored checks.

**5. Reconciliation:** visual filter `category` is `Reconciliation`. Columns `check_name`, `DQ Source A Value`, `DQ Source B Value`, `DQ Recon Variance`, `status`.

**6. Table profile:** columns `table_name`, `table_type`, `DQ Total Rows`, `DQ Null %`, `latest_data_date`, `DQ Days Behind`, `freshness_status`.

**7. Check results:** columns `check_id`, `category`, `check_name`, `DQ Rows Tested`, `DQ Rows Failed`, `DQ Row Pass Rate %`, `status`. Sort by `status` ascending so Fail and Warn come first. Add `check_description` as a last column if you want the explanation inline.

**8. Cleaning bar:** visual filter `category` is `Cleaning`. Axis `check_name`, value `DQ Rows Failed`, one colour (`#0288D1`).

**Status colours in the tables:** on the `status` column in 5 and 7, set Cell elements > Background colour > Format style: Field value > `DQ Status Colour`, with white font. Do the same on `freshness_status` in 6 with `DQ Freshness Colour`.

**Footnote text box** under the tables: *Digital sales, footfall transactions and footfall units reconcile to sales before returns. Returns exist only as lines in fact_sales, so Online net sales including returns is lower than Digital Net Sales by the value of the returns. Audit times are UTC.*

## Numbers to check against

From my 20 Sep 2026 run. If you regenerate on a later day the data runs up to that day, so the row counts and dates will move.

| Measure | Should show |
|---|---|
| Data Quality Score | 95.9% (71 of 74 checks passed) |
| DQ Overall Status | 3 warnings |
| DQ Scored Rows Tested | 84,838,199 |
| DQ Latest Data Date | 20 Sep 2026 |
| DQ Rows Fixed in Cleaning | 363,152 (of 3,948,592 raw lines) |
| DQ Tables Profiled / DQ Total Rows | 15 / 11,496,593 |
| DQ Null % | 0.001% |
| Score by category | Completeness 84.6%, Validity 95.7%, everything else 100% |