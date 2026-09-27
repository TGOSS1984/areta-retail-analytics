"use client";

import { AsyncView } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DqTable } from "@/lib/queries/dataPage";
import { STATUS_PILL } from "@/components/data/statusStyles";
import { formatCount } from "@/lib/format";

/** Every warehouse table: how big, how complete, and how up to date
 * against the lag it's allowed (stock is weekly, so a few days behind is
 * fine for it and not for daily sales). */
export function FreshnessTable({ state }: { state: AsyncState<DqTable[]> }) {
  return (
    <AsyncView state={state}>
      {(tables) => (
        <div className="h-full overflow-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[420px] border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-deep-terrain text-mist">
              <tr>
                {["Table", "Rows", "Nulls", "Latest", "Fresh?"].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-white/10 px-2 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.tableName} className="border-b border-white/5">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    <span className="block text-cloud">{t.tableName}</span>
                    <span className="block text-[10px] text-mist">{t.tableType}</span>
                  </th>
                  <td className="px-2 py-1.5 text-right text-cloud">{formatCount(t.rowCount, 2)}</td>
                  <td className="px-2 py-1.5 text-right text-mist">
                    {t.cellCount ? `${((t.nullCells / t.cellCount) * 100).toFixed(t.nullCells ? 3 : 0)}%` : "–"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-mist">
                    {t.latestDataDate ?? "–"}
                    {t.daysBehind !== null && t.allowedLagDays !== null && (
                      <span className="block text-[10px]">
                        {t.daysBehind}d behind, {t.allowedLagDays}d allowed
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_PILL[t.freshness] ?? STATUS_PILL["n/a"]}`}>{t.freshness}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AsyncView>
  );
}