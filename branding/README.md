# branding

Single source of truth for everything visual. Both `powerbi/theme/` and `web/styles/` end up pulling from here — nothing gets hand-duplicated between the two.

- `logo/` — working logo files. Just the transparent lockup for now; favicon and icon-only crops get added once we know the web app's actual size requirements.
- `reference/` — mood-board material: the full branding board and the colour palette board. Reference for humans, not something code reads directly.
- `theme/` — empty until we wire branding into the build. Will hold:
  - `areta-theme.json` — Power BI report theme, generated from the five core hex values
  - `tokens.css` (or `tailwind.config` extension) — the same five values as CSS custom properties / Tailwind theme colours for the web app

## Wiring plan (not done yet)

When we get to the web app: `theme/tokens.css` becomes the single place the five brand colours are declared, `web/` imports it, and the logo in `logo/` gets used for the header mark + favicon. Same principle on the Power BI side — `theme/areta-theme.json` is applied once at the report level rather than colours being picked per-visual. Neither exists yet; this folder is just the source everything else will point at.
