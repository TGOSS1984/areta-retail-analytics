"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchChannelMix, type MixSlice } from "@/lib/queries/salesMix";

export function useChannelMix(): AsyncState<MixSlice[]> {
  return useFilteredData(fetchChannelMix);
}