# 0001: Fictional brand, fully synthetic data

## Status
Accepted

## Context
I work in retail merchandising and wanted a portfolio project that looks and feels like a real retail analytics suite: a realistic store network, a realistic product hierarchy, realistic seasonal sales curves. The obvious shortcut was to lean on data and structures I know well from work.

## Decision
Everything in this repo (the brand, stores, products and sales) is invented. Areta Mountain Systems doesn't exist. No real company names, logos, store lists or product data appear anywhere in the project.

Real-world structure informed the *shape* of the data: a multi-brand product hierarchy, a dominant home market with several smaller European ones, a mix of owned stores and concessions. None of the actual content came from anywhere real.

The product photos in `web/public/images/products/` were generated with ChatGPT from my own prompts, so they show invented Areta products rather than real branded goods. Styles without a photo fall back to a placeholder for their product group.

## Consequences
- No trademark, copyright or confidentiality risk from anything in the repo.
- The sales curves, seasonality and market weighting all had to be built from scratch rather than copied. That's more work, and it's all in `generator/`.
- Anyone reviewing the repo can see exactly how the data was made, which suits a portfolio piece better than data with a story they have to take on trust.