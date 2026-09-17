"use client";

import { useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/**
 * Shared loading/error/ready pattern for anything that fetches via
 * DuckDB-wasm. useSalesSummary and useMonthlyTrend each hand-rolled this
 * exact same state machine before this existed — consolidating rather
 * than writing a third and fourth near-identical copy for the category
 * and channel mix charts.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load data",
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // fetcher is expected to be stable (module-level function references,
    // not recreated per render) — deps controls re-fetching explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}