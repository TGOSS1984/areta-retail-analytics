# powerbi

The Power BI report, saved as a Power BI Project (`.pbip`) so the model is text and the report is JSON, and both diff properly in git.

| | |
|---|---|
| `areta-retail-analytics.pbip` | Open this in Power BI Desktop |
| `areta-retail-analytics.SemanticModel/` | The model in TMDL: 26 tables, 472 measures, relationships and both calculation groups |
| `areta-retail-analytics.Report/` | The ten report pages, visuals and the custom theme |
| `deneb/` | The Vega-Lite specs for the Deneb visuals (the calendar heatmap and the gradient charts) |

The model imports the Parquet files in `data/warehouse/`, so run `python generator/weekly_refresh.py` first if you've just cloned the repo, then open the `.pbip` and refresh. The data path is hard-coded in the Power Query sources for now; making it a parameter is on the roadmap.

What each page shows, and what I'd still tidy on it, is in [`docs/report-pages.md`](../docs/report-pages.md). The measures are explained in [`docs/dax-measures.md`](../docs/dax-measures.md), and the trickier ones also carry a description in the TMDL, so hovering over them in Desktop tells you what they do.

Two things to know before editing the TMDL by hand:

- Close Power BI Desktop first. Desktop holds the files open and will overwrite your change when it next saves.
- If the generator adds a column, refresh the data before opening the model, or Desktop errors on the missing column.
