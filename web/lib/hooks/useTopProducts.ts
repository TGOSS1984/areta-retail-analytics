"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchTopProducts, type TopProduct } from "@/lib/queries/topProducts";

export function useTopProducts(limit = 10): AsyncState<TopProduct[]> {
  return useAsyncData(() => fetchTopProducts(limit), [limit]);
}