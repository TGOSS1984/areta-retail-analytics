"use client";

import { useEffect, useState } from "react";
import { fetchMonthlyTrend, type MonthlyTrend } from "@/lib/queries/monthlyTrend";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MonthlyTrend };

export function useMonthlyTrend(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchMonthlyTrend()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load trend data",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}