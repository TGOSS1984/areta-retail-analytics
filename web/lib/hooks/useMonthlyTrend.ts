"use client";

import type { AsyncState } from "@/lib/hooks/useAsyncData";
import { useFilteredData } from "@/lib/hooks/useFilteredData";
import { fetchMonthlyTrend, type MonthlyTrend } from "@/lib/queries/monthlyTrend";

export function useMonthlyTrend(): AsyncState<MonthlyTrend> {
  return useFilteredData(fetchMonthlyTrend);
}