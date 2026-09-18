"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchKpiTrends, type KpiTrends } from "@/lib/queries/kpiTrends";

export function useKpiTrends(): AsyncState<KpiTrends> {
  return useAsyncData(fetchKpiTrends);
}