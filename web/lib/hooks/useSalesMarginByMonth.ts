"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchSalesMarginByPeriod, type SalesMarginPoint } from "@/lib/queries/salesMarginByMonth";

/** Follows the global year, period range and market filters. */
export function useSalesMarginByPeriod(): AsyncState<SalesMarginPoint[]> {
  return useFilteredData(fetchSalesMarginByPeriod);
}