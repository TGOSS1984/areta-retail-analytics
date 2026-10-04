# 0003: Fabric as a proof of concept, not a rebuild

## Status
Proposed

## Context
I'm working towards DP-600, which is built around Microsoft Fabric: Lakehouses, Delta tables, Direct Lake semantic models, pipelines and Git integration. Areta already has most of what Fabric is designed for. It has a star schema written to Parquet, a Power BI project stored as PBIP/TMDL in Git, a SQL suite and a scheduled refresh. Showing the same model running on Fabric would tie the project to the exam in a way that's easy to check.

The catch is that Fabric isn't free to keep running. The trial is 60 days, and after that a capacity is billed by the hour. Anything that only works while a capacity exists can't be the main way people see this project.

## Decision
Fabric gets its own folder, `fabric/`, and a plan ([`docs/fabric-poc-plan.md`](../fabric-poc-plan.md)). It reads the same `data/warehouse` Parquet files from `main` and builds a Lakehouse, a Direct Lake version of the model and a scheduled pipeline from them.

Nothing else changes. The generator, `powerbi/`, the SQL suite and the web app keep working exactly as they do, with no dependency on Fabric. The Fabric workspace syncs to `fabric/workspace` on a separate branch, and I merge it into `main` by pull request.

## Consequences
- The project shows Fabric skills without betting the project on a paid service. When the capacity is paused or gone, the notebooks, SQL, workspace definitions, parity results and screenshots are still in the repo.
- There are two copies of the semantic model: the Import one in `powerbi/` (the real one) and the Direct Lake one in `fabric/workspace`. I'm accepting that. The parity check in `fabric/parity-check.md` is how I show they agree, and the Import model stays the source of truth.
- A few things the Import model does in Power Query or DAX (`dim_market`, the static lookup tables, `style_label`, the refresh timestamp) move into the Fabric notebook, because Direct Lake reads Delta tables as they are.
- Running costs sit with me. I keep them near zero by pausing the capacity between sessions.