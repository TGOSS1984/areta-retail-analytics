"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/lib/hooks/useFilters";
import { useAsyncData, type AsyncState } from "@/lib/hooks/useAsyncData";
import { fetchDataBounds, resolveFilters, type DataBounds } from "@/lib/filters/resolve";
import { filtersKey, type ResolvedFilters } from "@/lib/filters/filters";

export function useDataBounds(): AsyncState<DataBounds> {
  return useAsyncData(fetchDataBounds);
}

/** The current URL filters resolved against the data, or null until the
 * data's bounds have loaded. */
export function useResolvedFilters(): ResolvedFilters | null {
  const { raw } = useFilters();
  const [bounds, setBounds] = useState<DataBounds | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDataBounds()
      .then((b) => {
        if (!cancelled) setBounds(b);
      })
      .catch(() => {
        // The charts surface the load error themselves via their own query.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return bounds ? resolveFilters(raw, bounds) : null;
}

const NEVER = new Promise<never>(() => {});

/** Runs a page query against the current filters and re-runs it whenever
 * they change. Stays in "loading" until the filters have resolved. */
export function useFilteredData<T>(fetcher: (f: ResolvedFilters) => Promise<T>): AsyncState<T> {
  const filters = useResolvedFilters();
  const key = filters ? filtersKey(filters) : null;
  return useAsyncData(() => (filters ? fetcher(filters) : (NEVER as Promise<T>)), [key]);
}