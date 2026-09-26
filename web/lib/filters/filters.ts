// The global filters every page shares: business year, a range of
// business periods and a market. They live in the URL (?year=2026&from=1
// &to=7&market=UK) rather than in React state, so a filtered view can be
// bookmarked or shared, survives a refresh, and moves with you from page
// to page without a store library.

export type RawFilters = {
  year?: number;
  from?: number;
  to?: number;
  market?: string;
};

/** Filters after defaults and the data's own bounds are applied. Every
 * query takes one of these, never the raw URL values. */
export type ResolvedFilters = {
  year: number;
  periodFrom: number;
  periodTo: number;
  /** null = all markets */
  market: string | null;
  /** Inclusive date bounds of the selection, capped at the last day of data. */
  tyStart: string;
  tyEnd: string;
  /** The same days last year: business years are exactly 364 days, so
   * this is always the same weekday in the same business week. */
  lyStart: string;
  lyEnd: string;
  hasLastYear: boolean;
  /** Days in the selection, for annualising. */
  days: number;
  lastDataDate: string;
  /** Whether the selection ends before its last period does (the current
   * period is still trading). Targets get phased when it is. */
  isPartial: boolean;
};

const MARKET_CODE = /^[A-Z]{2,3}$/;

function toInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFilters(params: URLSearchParams): RawFilters {
  const market = params.get("market")?.toUpperCase();
  return {
    year: toInt(params.get("year")),
    from: toInt(params.get("from")),
    to: toInt(params.get("to")),
    // Checked against a strict pattern because it ends up inside SQL:
    // queryDuckDB has no parameter binding, so anything from the URL has
    // to be one of a known shape before it gets near a query.
    market: market && MARKET_CODE.test(market) ? market : undefined,
  };
}

export function serializeFilters(filters: RawFilters): string {
  const params = new URLSearchParams();
  if (filters.year !== undefined) params.set("year", String(filters.year));
  if (filters.from !== undefined) params.set("from", String(filters.from));
  if (filters.to !== undefined) params.set("to", String(filters.to));
  if (filters.market) params.set("market", filters.market);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** A stable key for a resolved selection, used as a re-fetch dependency. */
export function filtersKey(f: ResolvedFilters): string {
  return `${f.year}|${f.periodFrom}|${f.periodTo}|${f.market ?? "ALL"}|${f.tyEnd}`;
}