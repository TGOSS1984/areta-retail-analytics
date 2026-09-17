"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchCategoryMix, type MixSlice } from "@/lib/queries/salesMix";

export function useCategoryMix(): AsyncState<MixSlice[]> {
  return useAsyncData(fetchCategoryMix);
}