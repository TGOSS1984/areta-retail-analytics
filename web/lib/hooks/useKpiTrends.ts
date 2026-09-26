"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchKpiTrends, type KpiTrends } from "@/lib/queries/kpiTrends";

export function useKpiTrends(): AsyncState<KpiTrends> {
  return useFilteredData(fetchKpiTrends);
}