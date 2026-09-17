"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchChannelMix, type MixSlice } from "@/lib/queries/salesMix";

export function useChannelMix(): AsyncState<MixSlice[]> {
  return useAsyncData(fetchChannelMix);
}