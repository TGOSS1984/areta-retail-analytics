"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchSalesSummary, type SalesSummary } from "@/lib/queries/salesSummary";

export function useSalesSummary(): AsyncState<SalesSummary> {
  return useFilteredData(fetchSalesSummary);
}