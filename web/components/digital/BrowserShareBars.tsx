"use client";

import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchBrowsers } from "@/lib/queries/digitalPage";
import { formatCount, formatShare } from "@/lib/format";

/** Browser share as plain HTML bars rather than a chart: five rows read
 * faster as a list, and each can carry its pages per session alongside. */
export function BrowserShareBars() {
  const state = useFilteredData(fetchBrowsers);
  return (
    <AsyncView state={state}>
      {(rows) => {
        const top = Math.max(...rows.map((r) => r.share), 0.0001);
        return (
          <ul className="flex h-full flex-col justify-center gap-3">
            {rows.map((r) => (
              <li key={r.browser}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-cloud">{r.browser}</span>
                  <span className="text-mist">
                    <span className="text-cloud">{formatShare(r.share)}</span> · {formatCount(r.sessions)} sessions · {r.pagesPerSession.toFixed(1)} pages
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-summit-gold" style={{ width: `${(r.share / top) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        );
      }}
    </AsyncView>
  );
}