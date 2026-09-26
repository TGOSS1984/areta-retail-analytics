"use client";

import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { StoreRow } from "@/lib/queries/storesPage";
import { formatCount, formatGbpShort, formatShare, pctChange } from "@/lib/format";

type SortKey = "storeName" | "salesTy" | "yoy" | "conversion" | "salesPerSqFt" | "netContributionPct";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "storeName", label: "Store", numeric: false },
  { key: "salesTy", label: "Sales", numeric: true },
  { key: "yoy", label: "vs LY", numeric: true },
  { key: "conversion", label: "Conv.", numeric: true },
  { key: "salesPerSqFt", label: "£/sq ft", numeric: true },
  { key: "netContributionPct", label: "Net contr.", numeric: true },
];

function contributionTone(v: number | null): string {
  if (v === null) return "text-mist";
  if (v < 0) return "bg-error/25 text-cloud";
  if (v < 0.1) return "bg-warning/20 text-cloud";
  return "text-cloud";
}

/** Sortable league table of every physical store. The store column
 * sticks while the rest scrolls sideways on a phone; the header sticks
 * while the rows scroll inside the card. Net contribution is shaded red
 * below zero and amber under 10%, the same thresholds as the Power BI
 * Retail page. */
export function StoreLeagueTable({ state }: { state: AsyncState<StoreRow[]> }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "salesTy", desc: true });
  const [search, setSearch] = useState("");

  return (
    <AsyncView state={state}>
      {(rows) => <Table rows={rows} sort={sort} setSort={setSort} search={search} setSearch={setSearch} />}
    </AsyncView>
  );
}

function Table({
  rows,
  sort,
  setSort,
  search,
  setSearch,
}: {
  rows: StoreRow[];
  sort: { key: SortKey; desc: boolean };
  setSort: (s: { key: SortKey; desc: boolean }) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const sorted = useMemo(() => {
    const value = (r: StoreRow): number | string | null => {
      if (sort.key === "yoy") return pctChange(r.salesTy, r.salesLy);
      return r[sort.key];
    };
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.storeName.toLowerCase().includes(q) || r.market.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        // Blanks always sink to the bottom, whichever way it's sorted.
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
        return sort.desc ? -cmp : cmp;
      });
  }, [rows, sort, search]);

  return (
    <div className="flex h-full flex-col">
      <label className="relative mb-2 flex-shrink-0">
        <span className="sr-only">Search stores</span>
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${rows.length} stores`}
          className="w-full rounded-lg border border-white/10 bg-abyss/50 py-1.5 pl-8 pr-3 text-xs text-cloud placeholder:text-mist focus:border-summit-gold focus:outline-none"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-white/5">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-deep-terrain">
            <tr>
              {COLUMNS.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={`border-b border-white/10 px-2 py-2 font-medium text-mist ${c.numeric ? "text-right" : "text-left"} ${
                    i === 0 ? "sticky left-0 z-20 bg-deep-terrain" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="hover:text-cloud"
                    onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : c.numeric })}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.desc ? " ▼" : " ▲") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const yoy = pctChange(r.salesTy, r.salesLy);
              return (
                <tr key={r.storeId} className="border-b border-white/5 hover:bg-white/5">
                  <th scope="row" className="sticky left-0 max-w-[160px] bg-deep-terrain px-2 py-1.5 text-left font-normal">
                    <span className="block truncate text-cloud">{r.storeName}</span>
                    <span className="block truncate text-[10px] text-mist">
                      {r.market} · {r.storeType}
                    </span>
                  </th>
                  <td className="px-2 py-1.5 text-right text-cloud">{formatGbpShort(r.salesTy, 1)}</td>
                  <td className={`px-2 py-1.5 text-right ${yoy === null ? "text-mist" : yoy >= 0 ? "text-success" : "text-error"}`}>
                    {yoy === null ? "–" : `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right text-cloud">{formatShare(r.conversion)}</td>
                  <td className="px-2 py-1.5 text-right text-cloud">£{r.salesPerSqFt.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={`rounded px-1.5 py-0.5 ${contributionTone(r.netContributionPct)}`}>
                      {r.netContributionPct === null ? "–" : formatShare(r.netContributionPct)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="p-4 text-center text-xs text-mist">No stores match “{search}”.</p>}
      </div>
      <p className="mt-2 flex-shrink-0 text-[10px] text-mist">
        {formatCount(sorted.length)} stores · £/sq ft annualised · net contribution from the store P&amp;L
      </p>
    </div>
  );
}