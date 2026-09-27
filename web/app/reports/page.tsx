"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { PageFrame, PageHeader } from "@/components/layout/PageHeader";
import { NAV_ITEMS, FOOTER_ITEMS } from "@/lib/nav";
import { useFilters } from "@/lib/hooks/useFilters";

/** An index of every page: the question it answers and what's on it,
 * straight from the nav config, so it can't drift from the real pages. */
export default function ReportsPage() {
  const { query } = useFilters();
  const pages = [...NAV_ITEMS, ...FOOTER_ITEMS].filter((p) => p.href !== "/reports");

  return (
    <PageFrame>
      <PageHeader filters={false} />
      {/* The only page that can be taller than the screen on a desktop, so
          it scrolls inside the frame rather than being cut off. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:pr-1">
        {pages.map(({ label, href, icon: PageIcon, question, visuals }) => (
          <Link
            key={href}
            href={`${href}${query}`}
            className="group flex flex-col rounded-xl border border-white/10 bg-deep-terrain p-5 transition-colors hover:border-summit-gold/50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-summit-gold/15 text-summit-gold">
                <PageIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-cloud">{label}</h2>
                <p className="truncate text-xs text-mist">{question}</p>
              </div>
            </div>
            <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-xs text-mist">
              {visuals.map((v) => (
                <li key={v} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-summit-gold" />
                  {v}
                </li>
              ))}
            </ul>
            <span className="mt-4 flex items-center gap-1 text-xs text-summit-gold">
              Open {label} <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </PageFrame>
  );
}