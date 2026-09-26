"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchRegionalSales, type MarketPoint } from "@/lib/queries/regionalSales";

export function useRegionalSales(): AsyncState<MarketPoint[]> {
  return useFilteredData(fetchRegionalSales);
}