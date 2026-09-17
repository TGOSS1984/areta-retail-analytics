"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchMonthlyTrend, type MonthlyTrend } from "@/lib/queries/monthlyTrend";

export function useMonthlyTrend(): AsyncState<MonthlyTrend> {
  return useAsyncData(fetchMonthlyTrend);
}