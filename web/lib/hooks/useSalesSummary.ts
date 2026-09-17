"use client";

import { useEffect, useState } from "react";
import { fetchSalesSummary, type SalesSummary } from "@/lib/queries/salesSummary";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: SalesSummary };

export function useSalesSummary(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchSalesSummary()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load sales data",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}