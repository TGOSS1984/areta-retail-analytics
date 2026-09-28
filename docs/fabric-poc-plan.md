# Fabric proof of concept: plan

This is the plan for putting Areta on Microsoft Fabric as a side piece. I'm not rebuilding anything. The generator, `data/warehouse`, the Power BI project in `powerbi/` and the web app all stay exactly as they are, and Fabric becomes one more place the same data lands. The reasoning is in [ADR 0003](decisions/0003-fabric-proof-of-concept.md).

I'm doing this alongside DP-600, so each session maps to part of the exam. The point is to have something real to show for it, not just a certificate.

## What I'm going to prove

1. I can load the warehouse into a Lakehouse as Delta tables with a notebook, not by clicking through an upload.
2. The SQL suite runs on the Lakehouse SQL endpoint, and I can explain where T-SQL and DuckDB differ.
3. The full semantic model (399 measures, two calculation groups) works in **Direct Lake**, and gives the same numbers as the Import model in Desktop.
4. The load and the model refresh run on a schedule without me.
5. The Fabric workspace is in Git, so everything I build is in this repo, not just in a tenant that will eventually disappear.

## What the model needs before Direct Lake

I went through the TMDL to see what won't carry straight across. Direct Lake reads Delta tables as they are, with no Power Query in between, so anything the model currently does in M or in a calculated column has to move into the notebook.

| Table(s) | Today | In Fabric |
|---|---|---|
| 17 tables (every fact, `dim_date`, `dim_product`, `dim_store` and the rest) | `Parquet.Document` straight off a local path, no steps | Load as-is into Delta |
| `dim_market` | Three M steps: columns from `dim_store`, then distinct on `market_code` | Build in the notebook |
| `dim_product[style_label]` | Calculated column | Add the column in the notebook. As far as I know Direct Lake tables don't allow calculated columns, so this is the one DAX change |
| `dim_browser`, `dim_pnl_bridge`, `dim_currency_view`, `dim_vat_view` | Hand-typed `#table` | Write as small Delta tables from the notebook |
| `dim_report_metadata` | `DateTimeZone.FixedLocalNow()` at refresh | A one-row table the notebook stamps each time it runs, which is more honest anyway (it records when the data landed, not when the model refreshed) |
| `VAT View`, `Currency Conversion` | Calculation groups | Carry across unchanged. This is the bit I most want to see work |

The data is small. `fact_stock_snapshot` is the biggest at about 6.8 million rows, `fact_sales` is 3.9 million, and everything together is under 130 MB of Parquet. An F2 capacity is enough.

## Before the clock starts (no capacity needed)

- [ ] Create the tenant and the user (see "Account" below), and check I can sign in to app.fabric.microsoft.com
- [ ] Create the `fabric-poc` branch in GitHub
- [ ] Read through this plan once more and have the notebook half-written locally, so the first paid or trial hour goes on running it, not writing it

## Sessions

Each session is roughly two to four hours. On F2 I pause the capacity at the end of every one.

### Session 1: workspace, Git and the Lakehouse

- Create the capacity (F2, UK South), a workspace called `Areta POC`, and assign it.
- Connect the workspace to GitHub: repo `areta-retail-analytics`, branch `fabric-poc`, folder `fabric/workspace`. It must be that folder and nothing wider, so Fabric's sync can't touch anything else.
- Create a Lakehouse, `lh_areta`.
- **DP-600:** workspace settings, Git integration, Lakehouse basics.

### Session 2: load the warehouse

- Notebook `01_load_warehouse`: read the 17 Parquet files from the repo's raw GitHub URLs on `main`, write each one as a Delta table, then build `dim_market`, add `style_label`, write the four static tables and stamp the refresh table.
- Run `OPTIMIZE` on the two big facts, and check V-Order is on.
- Row counts in the notebook output must match DuckDB locally, table by table.
- **DP-600:** ingest with Spark, Delta tables, V-Order and table maintenance.

### Session 3: SQL on the endpoint

- Port a handful of queries from `sql/queries/`: one each from aggregation, joins, CTEs and window functions, and two business questions.
- Save them in `fabric/sql/` with a comment wherever T-SQL made me change something (`LIMIT` vs `TOP`, date functions, `QUALIFY`, and so on).
- **DP-600:** querying with T-SQL, views on the SQL endpoint.

### Session 4: Direct Lake model

- Create a Direct Lake semantic model on `lh_areta` with all the tables, then bring in the relationships, measures and calculation groups from the TMDL in `powerbi/`.
- Swap `style_label` from a calculated column to the Lakehouse column.
- **Parity check:** pick about 20 measures (sales, LY, margin, stock value, the VAT and currency combos) and a fixed filter (one business period, one market), then compare the Import model in Desktop with Direct Lake. Record the results in `fabric/parity-check.md`. Every mismatch is either a fix or a line in the write-up.
- Check whether any visual falls back to DirectQuery, and why.
- **DP-600:** Direct Lake, fallback behaviour, calculation groups, model design.

### Session 5: schedule it

- A pipeline: run the notebook, then refresh (reframe) the semantic model.
- Schedule it for Monday 07:00 UTC, an hour after the GitHub Actions refresh commits new data to `main`, so Fabric always picks up the new week.
- Rebind a copy of one or two report pages to the Direct Lake model, so there's something to screenshot.
- **DP-600:** pipelines, scheduling, refresh vs reframe.

### Session 6: evidence and teardown

- Screenshots: the workspace, lineage view, a notebook run, the pipeline history, a Direct Lake report page and the Capacity Metrics app.
- Write up `fabric/README.md` properly: what worked, what didn't, and the parity results.
- Merge `fabric-poc` into `main` with a pull request.
- Pause the capacity, or delete it if I'm done.

## Account

Fabric needs a work or school identity, but I can make one myself:

1. Create an Azure account with my personal email. That creates a Microsoft Entra ID tenant for me.
2. In Entra ID, create a user such as `tom@<tenant>.onmicrosoft.com`. That's the account I use for Fabric.
3. Either start the Fabric trial with that user (trials may be blocked on tenants less than 90 days old), or create an F2 capacity in the Azure portal, pay-as-you-go.
4. Publishing and sharing Power BI items in a Fabric workspace smaller than F64 needs a Power BI Pro licence or the Power BI individual trial, so I start that trial on the same user before session 4.

## Cost guardrails (F2 route)

- Pause the capacity at the end of every session. A paused capacity stops charging for compute, but storage is still billed (a few pence at this size).
- Set a budget alert in Azure Cost Management before creating the capacity.
- If the Azure free credit is still live, it should cover the whole plan.

## Keeping the rest of the repo safe

- Everything Fabric-related lives in `fabric/`, this plan and ADR 0003. Nothing in `powerbi/`, `data/`, `generator/`, `sql/queries/` or `web/` changes.
- Fabric only **reads** from `main` (raw URLs). It never writes to it.
- Fabric's Git sync is scoped to `fabric/workspace` on the `fabric-poc` branch. `main` only gets the work through a pull request I've reviewed.
- The weekly GitHub Action only commits to `data/warehouse` on `main`, so the two never meet.
- Vercel builds a preview for pushes to other branches. That's harmless, but if it gets noisy I can add an Ignored Build Step in the Vercel project settings so it only builds when `web/` changes.
- Nothing secret goes in the repo. Git integration writes item definitions and logical IDs, not credentials, but I'll check the first sync before merging anything.