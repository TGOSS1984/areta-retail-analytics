"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchTopProducts, type TopProduct } from "@/lib/queries/topProducts";

export function useTopProducts(limit = 10): AsyncState<TopProduct[]> {
  // limit is fixed per call site, so it doesn't need to be a dependency.
  return useFilteredData((f) => fetchTopProducts(f, limit));
}