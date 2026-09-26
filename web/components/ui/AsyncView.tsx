import type { ReactNode } from "react";
import type { AsyncState } from "@/lib/hooks/useAsyncData";

/** Loading shimmer, error message or the content, for anything backed by
 * a query. Keeps every chart's three states looking the same. */
export function AsyncView<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (state.status === "loading") {
    return <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />;
  }
  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-mist">
        Couldn&apos;t load this: {state.message}
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center p-4 text-center text-sm text-mist">{message}</div>;
}