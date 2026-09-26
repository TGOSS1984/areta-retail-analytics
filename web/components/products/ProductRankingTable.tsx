"use client";

import { useState } from "react";
import { AsyncView } from "@/components/ui/AsyncView";
import { ProductThumb } from "@/components/ui/ProductThumb";
import { Sparkline } from "@/components/ui/Sparkline";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchProductRanking } from "@/lib/queries/productsPage";
import { COLORS } from "@/lib/chartTheme";
import { formatGbpShort, pctChange } from "@/lib/format";

/** Table of the ten best or ten slowest style-colours, with a photo, a
 * weekly sparkline and the change on last year. Slowest is there because
 * the bottom of the range is where the buying decisions are. */
export function ProductRankingTable() {
  const [which, setWhich] = useState<"best" | "slowest">("best");
  const best = useFilteredData((f) => fetchProductRanking(f, "best"));
  const slowest = useFilteredData((f) => fetchProductRanking(f, "slowest"));
  const state = which === "best" ? best : slowest;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-shrink-0 gap-1 rounded-lg bg-abyss/40 p-1 text-xs" role="tablist">
        {(["best", "slowest"] as const).map((w) => (
          <button
            key={w}
            type="button"
            role="tab"
            aria-selected={which === w}
            onClick={() => setWhich(w)}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              which === w ? "bg-summit-gold/20 text-summit-gold" : "text-mist hover:text-cloud"
            }`}
          >
            {w === "best" ? "Best sellers" : "Slowest sellers"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AsyncView state={state}>
          {(rows) => (
            <ol className="flex flex-col divide-y divide-white/5">
              {rows.map((r, i) => {
                const yoy = pctChange(r.sales, r.salesLy);
                return (
                  <li key={`${r.styleCode}-${r.colourCode}`} className="flex items-center gap-3 py-2">
                    <span className="w-4 flex-shrink-0 text-right text-xs text-mist">{i + 1}</span>
                    <ProductThumb product={r} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-cloud">{r.styleName}</p>
                      <p className="truncate text-xs text-mist">
                        {r.colour} · {r.brand}
                      </p>
                    </div>
                    <span className="hidden sm:block">
                      <Sparkline data={r.weekly} color={which === "best" ? COLORS.gold : COLORS.mist} width={72} />
                    </span>
                    <div className="w-20 flex-shrink-0 text-right">
                      <p className="text-sm text-cloud">{formatGbpShort(r.sales, 1)}</p>
                      <p className={`text-xs ${yoy === null ? "text-mist" : yoy >= 0 ? "text-success" : "text-error"}`}>
                        {yoy === null ? "new" : `${yoy >= 0 ? "+" : ""}${yoy.toFixed(0)}% vs LY`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </AsyncView>
      </div>
    </div>
  );
}