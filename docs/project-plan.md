# Areta Retail Analytics — project plan

This is the living checklist against the original project notes. Anything
marked ⚠️ or ❌ below is a real gap — not a nice-to-have, a place where what
got built doesn't match what was actually asked for. This file is what I
check against going forward, not my own memory of the plan.

Status key: ✅ done and matches spec · ⚠️ built but wrong/incomplete · ❌ not
built · ⏸️ correctly not started yet (sequenced later)

---

## Phase 0 — Foundation

| Item | Status |
|---|---|
| Fictional brand decision (not real employer data) | ✅ |
| Brand: Areta Mountain Systems, multi-brand (Areta / Kestrel Ridge / Basecamp / Areta Pro) | ✅ |
| Repo scaffold, folder structure, ADRs, branding assets | ✅ |
| Colour palette, theme concepts | ✅ |

---

## Phase 1 — Data generator

### Dimensions

| Table | Status | Issue |
|---|---|---|
| `dim_date` | ⚠️ **rebuild needed** | Business year built as Jan-start; spec says **March–February**. Built 4 meteorological seasons; spec says **2-season SS (Mar–Aug) / AW (Sep–Feb)**. Built Monday-start weeks; spec says **Sunday–Saturday**. This is the most foundational fix — everything else joins to it. |
| `dim_store` | ⚠️ **needs rework + extension** | Market list wrong (see below). Missing `store_type` (outlet/destination/mall/high-street) and `region` — both explicitly requested. |
| `dim_product` | ⚠️ **needs extension** | Missing sub-brand level (spec: "brand / sub brand"). Missing AW/SS seasonality tag on the product itself (needed for the "becomes clearance over time" mechanic). Missing separate `colour_code` and `size_code` columns (currently only names). |
| `dim_currency` + `fx_rate_monthly` | ⚠️ **rebuild needed** | Depends on the market list fix — wrong currencies follow from the wrong markets. |
| `dim_promo` | ⚠️ **extend, don't rebuild** | Percentage-off structure is fine. Missing quantity-based multi-buy promos ("2 for £30" on fleece/t-shirts, "3 for 2" on accessories) — a different mechanic, not represented at all. |

**Market list** (`generator/config/markets.yml`) — spec: Germany, Italy, Poland, Czechia, Slovakia, **Latvia, Lithuania**, UK, Ireland, Holland (10 markets). Built: UK, Germany, Poland, Ireland, Italy, Netherlands, Czechia, Slovakia, and incorrectly added **France**. Missing Latvia and Lithuania entirely, France shouldn't be there. Fix this before rebuilding anything downstream.

### Facts

| Table | Status | Issue |
|---|---|---|
| `fact_sales` | ⚠️ **significant rework** | Margin-by-discount-tier doesn't work mathematically as built (produces negative margin at 60–70% off instead of the specified 50–60%) — needs a tier-based margin model, not cost-derived. **VAT entirely missing** — no rate by market, no inclusive/exclusive split. Multi-buy promos not modelled. Actuals currently run through the full 2026 year; spec says actuals stop at **present date**, targets continue to year end. Transaction/invoice grain — see decision needed below. |
| `fact_footfall` | ⚠️ **depends on fact_sales rework** | Transaction counts currently statistically derived from daily aggregate units rather than real baskets — see decision needed below. |
| `fact_targets` | ⚠️ **rework needed** | Currently only generates a target where an actual already exists. Once actuals stop at "present date," this silently drops every future period's target — needs restructuring to span the full range independent of whether actuals exist yet. |
| `fact_stock_snapshot` | ✅ structurally sound | Just needs to follow from the corrected calendar and sales data — no independent issues found. |
| `fact_store_finance` | ❌ **not built** | Gross contribution (sales − COGS − staff/rent/utilities/marketing) and net contribution (gross − head office allocation), targets ~30%/~25%, real store-to-store variance including some negative stores. This was in my own original schema sketch and I never built it. |

### Orchestration

| Item | Status |
|---|---|
| `weekly_refresh.py` | ⚠️ Will need a `fact_store_finance` step added, and the "stop at present date" logic once that's built |

### Decision needed from you

**Transaction/invoice grain.** Your notes ask for "invoices with differing amounts of units sold on each" — real baskets, not a derived approximation. I can add a genuine `invoice_id` to `fact_sales` (grouping multiple product lines into real baskets) without starting over completely, but it's a real change to the core simulation, not a quick patch. Want it built properly, or is the current derived approximation acceptable now that the KPIs it produces check out as sensible? Your call — I'd rather ask than guess again.

---

## Phase 2 — Power BI

| Item | Status |
|---|---|
| Relationship map, DAX measures reference, theme.json | ✅ delivered (documentation only — genuinely untested, I can't run Power BI Desktop) |
| Actual PBIP model / connections | ⏸️ **paused** — resume only once the data layer above is corrected, no point building relationships against data that's about to change shape |
| Report pages and visuals | ⏸️ not started, correctly sequenced after the model |
| `refresh-data.yml` GitHub Action | ⏸️ not started, correctly sequenced after the generator is finalised |

---

## Phase 3 — Web app

Not started. Correctly sequenced after Power BI — no gap here, this was always the plan.

---

## Phase 4 — Polish and remaining scope

| Item | Status |
|---|---|
| Product images linked at style/colour level | ❌ not started — always a later-stage item, still open |
| Real GitHub project board (not just this file) | ❌ not started, still open |
| Architecture diagrams for `docs/architecture/` | ❌ not started, still open |
| Competitor research pass (real outdoor retailers' sales curves, category cash-vs-volume mix, bank holiday uplifts) | ⚠️ partially covered by design choices (price-based demand, Black Friday/Boxing Day promo uplift) but the actual research was never done | 
| Year-over-year sales curve shape variation (not just random noise around an identical curve) | ⚠️ not implemented — same seasonal shape every year currently |

---

## Proposed rebuild sequence

Calendar is foundational — everything else joins to `dim_date`, so it goes
first. Market list next since store/currency/FX all depend on it. Then the
finance table (net new, no dependencies on the sales rework). Then the
`fact_sales` rework (margin tiers, VAT, multi-buy, present-date cutoff,
and the invoice decision above) — the biggest single piece. Then
`fact_targets`'s restructure, which depends on the present-date logic
existing. Then the attribute extensions to `dim_store`/`dim_product`,
which don't block anything else so they can slot in wherever's convenient.
Power BI resumes only once all of this is done and re-verified.

1. `dim_date` — business year, 2-season model, Sunday-start weeks
2. `markets.yml` — correct market list
3. `fact_store_finance` — new table
4. `fact_sales` rework — margin tiers, VAT, multi-buy promos, present-date cutoff, invoice grain (pending your steer)
5. `fact_targets` rework — span full range independent of actuals
6. `fact_footfall` / `fact_stock_snapshot` — re-verify against the above
7. `dim_store` / `dim_product` — store type, region, sub-brand, AW/SS tag, colour/size codes
8. `weekly_refresh.py` — updated step list
9. Resume Power BI

Everything gets tested the same way the first pass was — run against real
output, not just reviewed, before it's handed over.