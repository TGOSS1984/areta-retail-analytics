# Areta Retail Analytics — project plan

Living checklist, updated as things change rather than left to drift —
that discipline is what the original audit was for, so keeping it up
applies to this file too. Status key: done and matches spec, built but
needs work, not built, correctly not started yet.

---

## Current status (as of the mockup review)

**Data layer — complete and verified.** Five dimensions plus dim_period
(store_type/region on dim_store; sub_brand/season_label/colour_code/
size_code on dim_product), five fact tables (fact_sales at invoice grain
with margin tiers/VAT/multi-buy, fact_footfall on real invoice counts,
fact_stock_snapshot, fact_targets spanning the full business year,
fact_store_finance with calibrated gross/net contribution), all
orchestrated by weekly_refresh.py, all running end to end in ~60 seconds.
This is the part of the project that's actually finished.

**Power BI — in progress.** All eleven tables connected in the PBIP,
theme imported. Not yet done: relationships (use the map in
docs/dax-measures.md), formatting, DAX measures pasted in, report pages
built. Paused here by choice while the mockups got reviewed — resuming
next.

**Automation — done, untested live.** refresh-data.yml exists, hasn't
been triggered yet.

**Web app — not started.** Correctly sequenced after Power BI.

---

## New scope from the mockup review

Two real data gaps, not styling:

- **Online/Marketplace channel.** Both mockups show Online and
  Marketplace as sales channels alongside physical Retail — currently
  the model only has Retail/Concession, both physical. Needs a decision
  on scope (new channel in dim_store? A separate online-specific fact?)
  before building — this touches fact_sales' core simulation again, not
  a quick add.
- **Customer type** (Returning/New/Trade/Staff). Not modelled at all
  currently — no customer concept exists anywhere in the schema. Needs
  scoping: minimum viable is probably a column directly on fact_sales
  rather than a full customer dimension, but worth deciding deliberately
  rather than defaulting.

Two production tasks, scoped but not started:

- **Product images.** `image_url` column keyed by `style_code` on
  dim_product (images are per-style, not per-SKU), hosted via GitHub raw
  URLs so the same link works in both Power BI and the web app. Curated
  set for top 20-30 selling styles plus a per-product-group placeholder
  for everything else, not one image per style.
- **Favicon set.** Generated from the streamlined mark
  (branding/logo/areta-logo-mark.png), standard sizes (16/32/180/192/512
  + multi-res .ico). Web-app-phase task.

New assets in `branding/`: `logo/areta-logo-mark.png` (streamlined mark,
also the favicon source), `logo/areta-retail-analytics-wordmark.png`
(the analytics-product identity, distinct from the retail brand's own
logo), `reference/website-mockup.png`, `reference/powerbi-mockup.png`.

---

## Remaining phases, in order

1. **Decide** on the online channel and customer type additions above —
   scope and sequence them before touching fact_sales again.
2. **Power BI**: relationships, DAX, formatting, report pages — building
   toward what the two mockups show, adapted (the BI mockup's structure
   maps closely to an actual report; the website mockup is reference for
   the web app instead, not the PBIX).
3. **GitHub Action**: trigger refresh-data.yml manually once to confirm
   it actually works.
4. **Product images**: source/generate the curated set, add the column,
   wire into both PBI and the eventual web app.
5. **Web app**: Next.js + Tailwind + Tremor/ECharts + DuckDB-wasm, per
   the earlier ADR. Favicon set built here.
6. **Polish, still open from the original audit**: real GitHub project
   board (this file is standing in for one), architecture diagrams for
   docs/architecture/, competitor research pass on category sales
   curves, year-over-year seasonal curve shape variation.