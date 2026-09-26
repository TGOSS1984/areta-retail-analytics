"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseFilters, serializeFilters, type RawFilters } from "@/lib/filters/filters";

/** The raw filters in the URL and a setter that rewrites them. replace,
 * not push, so changing a slicer doesn't fill the back button with every
 * intermediate state. */
export function useFilters(): { raw: RawFilters; setFilters: (next: RawFilters) => void; query: string } {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const query = serializeFilters(raw);

  const setFilters = useCallback(
    (next: RawFilters) => {
      router.replace(`${pathname}${serializeFilters(next)}`, { scroll: false });
    },
    [router, pathname],
  );

  return { raw, setFilters, query };
}