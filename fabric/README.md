# Fabric proof of concept

> **Status: planned.** Nothing has been built in Fabric yet. The plan is in [`docs/fabric-poc-plan.md`](../docs/fabric-poc-plan.md) and the reasoning is in [ADR 0003](../docs/decisions/0003-fabric-proof-of-concept.md).

This folder is where Areta meets Microsoft Fabric. It's a side piece I'm building alongside DP-600, not a replacement for anything. The same Parquet files in `data/warehouse` that feed Power BI Desktop and the web app get loaded into a Fabric Lakehouse, and the semantic model runs there in Direct Lake mode.

Nothing outside this folder depends on it. If you're here to run the project yourself, you don't need Fabric at all.

## What will live here

```
fabric/
├── workspace/        synced by Fabric's Git integration (Lakehouse, notebook, pipeline, Direct Lake model)
├── sql/              queries from the SQL suite, ported to T-SQL for the SQL endpoint
├── parity-check.md   Import vs Direct Lake, measure by measure
└── README.md         this file, which becomes the write-up once it's built
```

`workspace/` is written by Fabric, not by hand. I edit things in Fabric and commit from there, so it stays in step with the workspace.