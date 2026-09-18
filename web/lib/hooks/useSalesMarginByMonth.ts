"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import {
  fetchSalesMarginByMonth,
  fetchAvailableYears,
  type SalesMarginByMonth,
} from "@/lib/queries/salesMarginByMonth";

export function useSalesMarginByMonth(year: number | null): AsyncState<SalesMarginByMonth> {
  return useAsyncData(() => {
    if (year === null) {
      // Never actually awaited by the caller — SalesMarginByMonthChart
      // only renders once the available-years fetch has resolved and
      // picked a default, so this branch exists only to keep the hook
      // callable before that default exists, same "lazy until ready"
      // shape as useRegionalSalesDrilldown's enabled flag.
      return new Promise<SalesMarginByMonth>(() => {});
    }
    return fetchSalesMarginByMonth(year);
  }, [year]);
}

export function useAvailableYears(): AsyncState<number[]> {
  return useAsyncData(fetchAvailableYears);
}