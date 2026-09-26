"use client";

import { AsyncView } from "@/components/ui/AsyncView";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchMarginMatrix } from "@/lib/queries/marginsPage";

/** A proper matrix, as an HTML table rather than a chart: product groups
 * down the side (biggest first), business periods across, gross margin in
 * each cell and the total on the right. Cells are shaded against the
 * overall margin, green above and red below, so the eye goes to the
 * groups and weeks that are giving margin away. The first column sticks
 * when it scrolls sideways; the header sticks when it scrolls down. */
export function MarginMatrix() {
  const state = useFilteredData(fetchMarginMatrix);
  return (
    <AsyncView state={state}>
      {(cells) => {
        const periods = Array.from(new Set(cells.map((c) => c.period))).sort((a, b) => a - b);
        const groups = new Map<string, { sales: number; cost: number; byPeriod: Map<number, number> }>();
        for (const c of cells) {
          const g = groups.get(c.productGroup) ?? { sales: 0, cost: 0, byPeriod: new Map() };
          g.sales += c.sales;
          g.cost += c.sales * (1 - c.margin);
          g.byPeriod.set(c.period, c.margin);
          groups.set(c.productGroup, g);
        }
        const rows = Array.from(groups.entries()).sort((a, b) => b[1].sales - a[1].sales);
        const totalSales = rows.reduce((a, [, g]) => a + g.sales, 0);
        const overall = totalSales ? 1 - rows.reduce((a, [, g]) => a + g.cost, 0) / totalSales : 0;

        // Shade by distance from the overall margin: full strength at
        // 10 points either side.
        const shade = (m: number | undefined) => {
          if (m === undefined) return undefined;
          const d = Math.max(-1, Math.min(1, (m - overall) / 0.1));
          return d >= 0 ? `rgba(76,175,80,${(d * 0.45).toFixed(2)})` : `rgba(239,83,80,${(-d * 0.55).toFixed(2)})`;
        };

        return (
          <div className="h-full overflow-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[480px] border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-deep-terrain">
                <tr>
                  <th scope="col" className="sticky left-0 z-20 border-b border-white/10 bg-deep-terrain px-2 py-2 text-left font-medium text-mist">
                    Product group
                  </th>
                  {periods.map((p) => (
                    <th key={p} scope="col" className="border-b border-white/10 px-1.5 py-2 text-right font-medium text-mist">
                      P{String(p).padStart(2, "0")}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-l border-white/10 px-2 py-2 text-right font-medium text-cloud">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, g]) => {
                  const total = g.sales ? 1 - g.cost / g.sales : 0;
                  return (
                    <tr key={name} className="border-b border-white/5">
                      <th scope="row" className="sticky left-0 max-w-[150px] truncate bg-deep-terrain px-2 py-1 text-left font-normal text-cloud">
                        {name}
                      </th>
                      {periods.map((p) => {
                        const m = g.byPeriod.get(p);
                        return (
                          <td key={p} className="px-1.5 py-1 text-right text-cloud" style={{ backgroundColor: shade(m) }}>
                            {m === undefined ? "–" : `${(m * 100).toFixed(0)}%`}
                          </td>
                        );
                      })}
                      <td className="border-l border-white/10 px-2 py-1 text-right font-medium text-cloud" style={{ backgroundColor: shade(total) }}>
                        {(total * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-2 py-2 text-[10px] text-mist">
              Shaded against the overall margin of {(overall * 100).toFixed(1)}%: green above, red below.
            </p>
          </div>
        );
      }}
    </AsyncView>
  );
}