"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchSalesSummary, type SalesSummary } from "@/lib/queries/salesSummary";

export function useSalesSummary(): AsyncState<SalesSummary> {
  return useAsyncData(fetchSalesSummary);
}