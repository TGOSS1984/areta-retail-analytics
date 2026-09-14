# 0001 — Fictional brand, fully synthetic data

## Status
Accepted

## Context
I work in retail merchandising and wanted a portfolio project that looks and feels like a real retail analytics suite — real-shaped store networks, real-shaped product hierarchies, real-shaped seasonal sales curves. The obvious shortcut was to lean on data and structures I already know well from work.

## Decision
Everything in this repo — brand, stores, products, sales — is invented. Areta Mountain Systems doesn't exist. No real company names, logos, product images, or store lists appear anywhere in this project.

Real-world structure (multi-brand product hierarchy, a dominant home market plus several secondary European markets, a mix of owned retail and concession stores) informed the *shape* of the synthetic data — row counts, hierarchy depth, market spread — but none of the literal content.

## Consequences
- No trademark, copyright, or confidentiality risk from anything in this repo.
- The dataset needs its own sales curves, seasonality, and market weighting built from scratch rather than copied from a real source — more work up front, covered in `generator/config/`.
- Anyone reviewing this repo (recruiter, hiring manager, fellow analyst) can see exactly how the data was built, which is a feature for a portfolio piece, not a limitation.
