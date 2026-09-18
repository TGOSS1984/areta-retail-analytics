"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchRegionalSalesDrilldown, type RegionPoint } from "@/lib/queries/regionalSalesDrilldown";

/**
 * enabled=false skips the DuckDB query entirely rather than firing it
 * on mount regardless of visibility, unlike the always-on-screen charts
 * elsewhere on this page — this data is only ever needed after the user
 * clicks to drill into a market, so there's no reason to query it
 * before that happens.
 */
export function useRegionalSalesDrilldown(marketCode: string, enabled: boolean): AsyncState<RegionPoint[]> {
  return useAsyncData(
    () => (enabled ? fetchRegionalSalesDrilldown(marketCode) : Promise.resolve([])),
    [marketCode, enabled],
  );
}