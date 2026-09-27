"use client";

import { AsyncView, EmptyState } from "@/components/ui/AsyncView";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { Forecast } from "@/lib/queries/forecastPage";
import { formatGbpShort } from "@/lib/format";

const STATUS: Record<string, { label: string; className: string }> = {
  complete: { label: "Actual", className: "bg-white/10 text-cloud" },
  trading: { label: "Trading", className: "bg-summit-gold/20 text-summit-gold" },
  future: { label: "Projected", className: "bg-mountain-teal/25 text-cloud" },
};

/** Period by period: last year, target, and this year's number, which is
 * the actual for finished periods, actual-plus-projection for the one
 * still trading, and projection for the rest. Tagged so nobody mistakes
 * a projection for a result. */
export function ProjectionTable({ state }: { state: AsyncState<Forecast> }) {
  return (
    <AsyncView state={state}>
      {(fc) => {
        if (!fc.available) return <EmptyState message={fc.reason} />;
        return (
          <div className="h-full overflow-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-deep-terrain text-mist">
                <tr>
                  {["Period", "Last year", "Target", "This year", "", "vs target", "vs LY"].map((h, i) => (
                    <th key={i} scope="col" className={`border-b border-white/10 px-2 py-2 font-medium ${i === 0 || i === 4 ? "text-left" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fc.periods.map((p) => {
                  const vsTarget = p.target ? (p.projected / p.target - 1) * 100 : null;
                  const vsLy = p.ly ? (p.projected / p.ly - 1) * 100 : null;
                  const tone = (v: number | null) => (v === null ? "text-mist" : v >= 0 ? "text-success" : "text-error");
                  const s = STATUS[p.status];
                  return (
                    <tr key={p.period} className="border-b border-white/5">
                      <th scope="row" className="px-2 py-1.5 text-left font-normal text-cloud">
                        {p.label}
                      </th>
                      <td className="px-2 py-1.5 text-right text-mist">{formatGbpShort(p.ly, 2)}</td>
                      <td className="px-2 py-1.5 text-right text-mist">{formatGbpShort(p.target, 2)}</td>
                      <td className="px-2 py-1.5 text-right text-cloud">{formatGbpShort(p.projected, 2)}</td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${s.className}`}>{s.label}</span>
                      </td>
                      <td className={`px-2 py-1.5 text-right ${tone(vsTarget)}`}>
                        {vsTarget === null ? "–" : `${vsTarget >= 0 ? "+" : ""}${vsTarget.toFixed(1)}%`}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${tone(vsLy)}`}>
                        {vsLy === null ? "–" : `${vsLy >= 0 ? "+" : ""}${vsLy.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-deep-terrain">
                <tr className="border-t border-white/10 font-medium">
                  <th scope="row" className="px-2 py-2 text-left text-cloud">Year</th>
                  <td className="px-2 py-2 text-right text-mist">{formatGbpShort(fc.lyFull, 2)}</td>
                  <td className="px-2 py-2 text-right text-mist">{formatGbpShort(fc.targetFull, 2)}</td>
                  <td className="px-2 py-2 text-right text-cloud">{formatGbpShort(fc.projected, 2)}</td>
                  <td />
                  <td className={`px-2 py-2 text-right ${fc.projected >= fc.targetFull ? "text-success" : "text-error"}`}>
                    {fc.targetFull ? `${((fc.projected / fc.targetFull - 1) * 100).toFixed(1)}%` : "–"}
                  </td>
                  <td className={`px-2 py-2 text-right ${fc.projected >= fc.lyFull ? "text-success" : "text-error"}`}>
                    {fc.lyFull ? `${((fc.projected / fc.lyFull - 1) * 100).toFixed(1)}%` : "–"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }}
    </AsyncView>
  );
}