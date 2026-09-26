"use client";

import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { filtersKey } from "@/lib/filters/filters";
import {
  fetchSalesMarginByMonth,
  fetchAvailableYears,
  type SalesMarginByMonth,
} from "@/lib/queries/salesMarginByMonth";

const NEVER = new Promise<never>(() => {});

/** Calendar year from the chart's own picker; market from the global filter. */
export function useSalesMarginByMonth(year: number | null): AsyncState<SalesMarginByMonth> {
  const f = useResolvedFilters();
  return useAsyncData(
    () => (year === null || !f ? (NEVER as Promise<SalesMarginByMonth>) : fetchSalesMarginByMonth(year, f)),
    [year, f ? filtersKey(f) : null],
  );
}

export function useAvailableYears(): AsyncState<number[]> {
  return useAsyncData(fetchAvailableYears);
}