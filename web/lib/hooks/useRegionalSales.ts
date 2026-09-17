"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchRegionalSales, type MarketPoint } from "@/lib/queries/regionalSales";

export function useRegionalSales(): AsyncState<MarketPoint[]> {
  return useAsyncData(fetchRegionalSales);
}