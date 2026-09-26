"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchCategoryMix, type MixSlice } from "@/lib/queries/salesMix";

export function useCategoryMix(): AsyncState<MixSlice[]> {
  return useFilteredData(fetchCategoryMix);
}