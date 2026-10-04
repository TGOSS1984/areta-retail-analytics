# branding

Everything visual starts here, so the report and the web app look like the same product.

- `logo/`: the Areta logo, the logo mark on its own, the Retail Analytics wordmark, and an alternative logo for the clothing.
- `theme/areta-theme.json`: the Power BI report theme. It uses the same five core colours as `web/tailwind.config.ts`, so a chart in the report and the same chart on the web match.
- `icons/`: about a hundred Tabler icons in four variants (gold on a dark tile, teal on a white tile, and gold or teal on a transparent background), made by `generate_icons.py` from one list, so any variant swaps in without anything moving. The KPI cards and page navigation use them. `icons/favicon/` holds the browser favicon, drawn from a simplified version of the mark because the full one turns to mush at 16 pixels.
- `reference/`: the brand board, colour palette, mock-ups and contact sheets I worked from. Reference for people; nothing reads them.
- `areta-banner.png`: the banner at the top of the README.