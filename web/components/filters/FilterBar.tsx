"use client";

import { IconCalendarEvent, IconWorld, IconRefresh } from "@tabler/icons-react";
import { useFilters } from "@/lib/hooks/useFilters";
import { useDataBounds } from "@/lib/hooks/useFilteredData";
import { resolveFilters } from "@/lib/filters/resolve";
import { formatShortDate } from "@/lib/filters/dates";

const selectClass =
  "min-w-0 appearance-none rounded-full border border-white/20 bg-abyss/60 py-1.5 pl-3 pr-7 text-xs text-cloud backdrop-blur focus:border-summit-gold focus:outline-none";

/** Year, period range and market, the same four controls on every page.
 * Writes to the URL; every chart on the page re-queries from there. */
export function FilterBar() {
  const { raw, setFilters } = useFilters();
  const bounds = useDataBounds();

  if (bounds.status !== "ready") {
    return <div className="h-8 w-72 animate-pulse rounded-full bg-white/10" />;
  }
  const b = bounds.data;
  const f = resolveFilters(raw, b);
  const years = Object.keys(b.maxPeriodByYear).map(Number).sort((x, y) => y - x);
  const periods = Array.from({ length: b.maxPeriodByYear[f.year] }, (_, i) => i + 1);
  const isDefault = raw.year === undefined && raw.from === undefined && raw.to === undefined && !raw.market;

  const chevron = (
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-mist">▼</span>
  );

  return (
    <div className="flex flex-col gap-2 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <IconCalendarEvent size={16} className="text-summit-gold" aria-hidden="true" />
        <label className="relative">
          <span className="sr-only">Business year</span>
          <select
            className={selectClass}
            value={f.year}
            // A new year starts from its full range again; the old
            // period picks may not exist in it.
            onChange={(e) => setFilters({ ...raw, year: Number(e.target.value), from: undefined, to: undefined })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                BY{String(y).slice(2)}
              </option>
            ))}
          </select>
          {chevron}
        </label>
        <label className="relative">
          <span className="sr-only">From period</span>
          <select
            className={selectClass}
            value={f.periodFrom}
            onChange={(e) => setFilters({ ...raw, year: f.year, from: Number(e.target.value), to: f.periodTo })}
          >
            {periods.map((p) => (
              <option key={p} value={p} disabled={p > f.periodTo}>
                P{String(p).padStart(2, "0")}
              </option>
            ))}
          </select>
          {chevron}
        </label>
        <span className="text-xs text-mist">to</span>
        <label className="relative">
          <span className="sr-only">To period</span>
          <select
            className={selectClass}
            value={f.periodTo}
            onChange={(e) => setFilters({ ...raw, year: f.year, from: f.periodFrom, to: Number(e.target.value) })}
          >
            {periods.map((p) => (
              <option key={p} value={p} disabled={p < f.periodFrom}>
                P{String(p).padStart(2, "0")}
              </option>
            ))}
          </select>
          {chevron}
        </label>
        <IconWorld size={16} className="ml-1 text-summit-gold" aria-hidden="true" />
        <label className="relative">
          <span className="sr-only">Market</span>
          <select
            className={selectClass}
            value={f.market ?? ""}
            onChange={(e) => setFilters({ ...raw, market: e.target.value || undefined })}
          >
            <option value="">All markets</option>
            {b.markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
          {chevron}
        </label>
        {!isDefault && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-mist hover:text-cloud"
          >
            <IconRefresh size={14} aria-hidden="true" /> Reset
          </button>
        )}
      </div>
      <p className="text-[11px] text-mist">
        {formatShortDate(f.tyStart)} – {formatShortDate(f.tyEnd)}
        {f.isPartial ? " (period still trading)" : ""}
        {f.hasLastYear ? " · compared with the same days last year" : " · no earlier year to compare with"}
      </p>
    </div>
  );
}