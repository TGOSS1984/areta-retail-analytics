"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { filtersKey } from "@/lib/filters/filters";
import { fetchRegionalSalesDrilldown, type RegionPoint } from "@/lib/queries/regionalSalesDrilldown";

/**
 * enabled=false skips the query entirely: this data is only needed after
 * the user clicks into a market, so there's no reason to fetch it before.
 */
export function useRegionalSalesDrilldown(marketCode: string, enabled: boolean): AsyncState<RegionPoint[]> {
  const f = useResolvedFilters();
  return useAsyncData(
    () => (enabled && f ? fetchRegionalSalesDrilldown(marketCode, f) : Promise.resolve([])),
    [marketCode, enabled, f ? filtersKey(f) : null],
  );
}