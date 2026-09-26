"use client";

import { usePathname } from "next/navigation";
import { navItemFor } from "@/lib/nav";
import { PageFrame, PageHeader } from "@/components/layout/PageHeader";

type ComingSoonProps = {
  round: 2 | 3;
  visuals: string[];
};

/** A real route with an honest note, rather than a nav link that does
 * nothing. Lists what the page will hold so the plan is visible. */
export function ComingSoon({ round, visuals }: ComingSoonProps) {
  const item = navItemFor(usePathname());
  return (
    <PageFrame>
      <PageHeader />
      <div className="rounded-xl border border-dashed border-white/15 bg-deep-terrain/60 p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-summit-gold">Coming in round {round}</p>
        <h2 className="mt-2 text-lg font-medium text-cloud">{item?.label} is being built</h2>
        <p className="mt-2 max-w-xl text-sm text-mist">
          This page will run on the same exported data and filters as the rest of the app. What it will show:
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-cloud md:grid-cols-2">
          {visuals.map((v) => (
            <li key={v} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-summit-gold" />
              {v}
            </li>
          ))}
        </ul>
      </div>
    </PageFrame>
  );
}