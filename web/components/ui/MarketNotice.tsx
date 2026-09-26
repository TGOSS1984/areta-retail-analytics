"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { useResolvedFilters } from "@/lib/hooks/useFilteredData";

/** Shown on pages whose data can't follow the market filter, only when a
 * market is actually selected, so nobody reads all-markets numbers as
 * one market's. */
export function MarketNotice({ reason }: { reason: string }) {
  const f = useResolvedFilters();
  if (!f?.market) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg bg-charcoal/40 px-3 py-2 text-xs text-cloud backdrop-blur-sm">
      <IconInfoCircle size={14} className="flex-shrink-0 text-summit-gold" aria-hidden="true" />
      Showing all markets: {reason}
    </p>
  );
}