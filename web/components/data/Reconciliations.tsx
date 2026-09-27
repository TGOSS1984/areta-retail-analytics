"use client";

import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DqCheck } from "@/lib/queries/dataPage";
import { STATUS_PILL } from "@/components/data/statusStyles";

function fmt(v: number | null): string {
  if (v === null) return "–";
  return Math.abs(v) >= 1000 ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

/** The reconciliation checks as pairs of numbers that should agree: the
 * same total worked out from two different tables. Seeing both numbers
 * side by side is more convincing than a green tick on its own. */
export function Reconciliations({ state }: { state: AsyncState<DqCheck[]> }) {
  return (
    <AsyncView state={state}>
      {(checks) => {
        const recs = checks.filter((c) => c.category === "Reconciliation");
        return (
          <ul className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
            {recs.map((c) => (
              <li key={c.checkId} className="rounded-lg bg-white/5 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-cloud">{c.checkName}</p>
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] ${STATUS_PILL[c.status] ?? STATUS_PILL["n/a"]}`}>{c.status}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="min-w-0">
                    <p className="truncate text-mist">{c.sourceALabel ?? "Source A"}</p>
                    <p className="text-cloud">{fmt(c.sourceAValue)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-mist">{c.sourceBLabel ?? "Source B"}</p>
                    <p className="text-cloud">{fmt(c.sourceBValue)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        );
      }}
    </AsyncView>
  );
}