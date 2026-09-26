import type { ResolvedFilters } from "@/lib/filters/filters";

// Small SQL fragments every page query builds from, so "this year",
// "last year" and "this market" mean exactly the same thing on every
// chart. Values are either dates the app computed itself or a market code
// already checked against a strict pattern and the real market list in
// resolveFilters, so interpolating them is safe.

export function tyDates(f: ResolvedFilters, column: string): string {
  return `${column} BETWEEN DATE '${f.tyStart}' AND DATE '${f.tyEnd}'`;
}

export function lyDates(f: ResolvedFilters, column: string): string {
  return `${column} BETWEEN DATE '${f.lyStart}' AND DATE '${f.lyEnd}'`;
}

/** `AND <storeAlias>.market_code = 'UK'`, or nothing for all markets. */
export function marketAnd(f: ResolvedFilters, storeAlias: string): string {
  return f.market ? `AND ${storeAlias}.market_code = '${f.market}'` : "";
}

/** The selected business periods, for tables keyed by year and period
 * (targets, store finance) rather than by date. */
export function periodsAnd(f: ResolvedFilters, alias: string): string {
  return `AND ${alias}.business_year = ${f.year} AND ${alias}.business_period_number BETWEEN ${f.periodFrom} AND ${f.periodTo}`;
}