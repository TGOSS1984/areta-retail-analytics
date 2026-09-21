# Deneb gradient charts

Power BI's own bar and line charts can't put a gradient inside each bar or under a line, so these are Vega-Lite specs for the free **Deneb** custom visual. Every bar gets the same light-to-dark fade, whatever its height, and the line charts fill under the line.

| File | Chart |
|---|---|
| `deneb-gradient-columns.json` | Columns, fading light at the base to teal at the tip |
| `deneb-gradient-bars.json` | Horizontal bars, fading light on the left to teal on the right |
| `deneb-gradient-area-fade.json` | Line with a translucent teal fill that fades out at the baseline |
| `deneb-gradient-area-solid.json` | Line with the same two-colour fill as the bars |

## Using one

1. Add the Deneb visual (Get more visuals > "Deneb") and put your fields in its Values well.
2. Edit > choose Vega-Lite > paste the JSON over the template > Apply.

## Pointing it at different fields

I kept every field name in one place, the `transform` block at the top of each spec. Everything below it only uses the generic names `category`, `value` and (on the line charts) `sort_key`, so I never touch the chart definition to reuse it.

```json
{"calculate": "datum['major_product_group']", "as": "category"},
{"calculate": "datum['Net Sales (GBP)']",      "as": "value"},
```

Change the text inside `datum['...']` to the name of the field as it shows in the Deneb Values well. The names are case sensitive and a measure's name is its own name, e.g. `Net Sales (GBP)`.

- **Line charts** also need `sort_key`, which is what puts the categories in order. For periods I use `period_key`. If the x axis is a date, point both `category` and `sort_key` at the date field.
- **Not money?** The `label` line sets the data label and tooltip format. For units use `format(datum.value, ',.0f')`, for a percentage `format(datum.value, '.1%')`. For a percentage also change the axis `format` from `~s` to `.0%`.
- **Colours** are the two gradient stops in each spec: `#B1CED5` (a 65% tint of the theme teal) and `#1F7486`. Swap them to flip the fade.

## Notes

- The current in-progress period shows as a dip on the line charts, so filter the visual to completed periods.
- The bar specs dim unselected bars when Cross-filtering is switched on in Deneb's settings.
- These are custom visuals, so they don't inherit the report theme and don't have the native visuals' drill-down.