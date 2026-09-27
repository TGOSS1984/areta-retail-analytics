"use client";

import { Fragment, useMemo, useState } from "react";
import { IconSearch, IconChevronDown } from "@tabler/icons-react";
import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DqCheck } from "@/lib/queries/dataPage";
import { STATUS_PILL } from "@/components/data/statusStyles";
import { formatCount } from "@/lib/format";

const FILTERS = ["Needs a look", "All", "Pass", "Fixed"] as const;

/** Every check the audit ran. Opens on the ones that need a look (warn or
 * fail), with a search box, and each row expands to say in words what the
 * check tests. */
export function ChecksTable({ state }: { state: AsyncState<DqCheck[]> }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Needs a look");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <AsyncView state={state}>
      {(checks) => (
        <Body
          checks={checks}
          filter={filter}
          setFilter={setFilter}
          search={search}
          setSearch={setSearch}
          open={open}
          setOpen={setOpen}
        />
      )}
    </AsyncView>
  );
}

function Body({
  checks, filter, setFilter, search, setSearch, open, setOpen,
}: {
  checks: DqCheck[];
  filter: (typeof FILTERS)[number];
  setFilter: (f: (typeof FILTERS)[number]) => void;
  search: string;
  setSearch: (s: string) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checks.filter((c) => {
      if (filter === "Needs a look" && c.status !== "Warn" && c.status !== "Fail") return false;
      if (filter === "Pass" && c.status !== "Pass") return false;
      if (filter === "Fixed" && c.status !== "Fixed") return false;
      return !q || `${c.checkId} ${c.checkName} ${c.tableName} ${c.category}`.toLowerCase().includes(q);
    });
  }, [checks, filter, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 flex-col gap-2 sm:flex-row">
        <div className="flex gap-1 rounded-lg bg-abyss/40 p-1 text-xs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 ${filter === f ? "bg-summit-gold/20 text-summit-gold" : "text-mist hover:text-cloud"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Search checks</span>
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${checks.length} checks`}
            className="w-full rounded-lg border border-white/10 bg-abyss/50 py-1.5 pl-8 pr-3 text-xs text-cloud placeholder:text-mist focus:border-summit-gold focus:outline-none"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-white/5">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-deep-terrain text-mist">
            <tr>
              {["ID", "Check", "Table", "Tested", "Failed", "Status", ""].map((h, i) => (
                <th key={i} scope="col" className={`border-b border-white/10 px-2 py-2 font-medium ${i >= 3 && i <= 4 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.checkId}>
                <tr
                  className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                  onClick={() => setOpen(open === c.checkId ? null : c.checkId)}
                  aria-expanded={open === c.checkId}
                >
                  <td className="whitespace-nowrap px-2 py-1.5 text-mist">{c.checkId}</td>
                  <td className="px-2 py-1.5 text-cloud">{c.checkName}</td>
                  <td className="px-2 py-1.5 text-mist">{c.tableName}</td>
                  <td className="px-2 py-1.5 text-right text-mist">{formatCount(c.rowsTested)}</td>
                  <td className={`px-2 py-1.5 text-right ${c.rowsFailed ? "text-cloud" : "text-mist"}`}>{formatCount(c.rowsFailed)}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_PILL[c.status] ?? STATUS_PILL["n/a"]}`}>{c.status}</span>
                  </td>
                  <td className="px-2 py-1.5 text-mist">
                    <IconChevronDown size={14} className={`transition-transform ${open === c.checkId ? "rotate-180" : ""}`} aria-hidden="true" />
                  </td>
                </tr>
                {open === c.checkId && (
                  <tr className="border-b border-white/5 bg-white/[0.03]">
                    <td />
                    <td colSpan={6} className="px-2 py-2 text-xs text-mist">
                      {c.description}
                      <span className="ml-2 text-[10px]">
                        {c.category} · {c.severity}
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-center text-xs text-mist">
            {filter === "Needs a look" && !search ? "Nothing needs a look: every check passed." : "No checks match."}
          </p>
        )}
      </div>
    </div>
  );
}