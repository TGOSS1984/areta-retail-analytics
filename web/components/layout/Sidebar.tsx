"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, FOOTER_ITEMS, type NavItem } from "@/lib/nav";
import { useFilters } from "@/lib/hooks/useFilters";

type SidebarProps = {
  /** "responsive": the fixed sidebar, a 72px icon rail on tablets and the
   * full 240px panel on desktop. "drawer": always full width, for the
   * phone slide-out menu. */
  variant?: "responsive" | "drawer";
  onNavigate?: () => void;
};

export function Sidebar({ variant = "responsive", onNavigate }: SidebarProps) {
  const pathname = usePathname();
  // Links carry the current filters with them, so moving from Sales to
  // Stores keeps the same year, periods and market.
  const { query } = useFilters();
  const rail = variant === "responsive";
  // In the rail, labels only appear from xl up; in the drawer, always.
  const labelClass = rail ? "hidden xl:inline" : "inline";

  const renderLink = ({ label, href, icon: ItemIcon }: NavItem) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={label}
        href={`${href}${query}`}
        onClick={onNavigate}
        title={label}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          rail ? "justify-center xl:justify-start" : ""
        } ${isActive ? "bg-summit-gold/15 text-summit-gold" : "text-mist hover:bg-white/5 hover:text-cloud"}`}
      >
        <ItemIcon size={18} stroke={1.75} aria-hidden="true" className="flex-shrink-0" />
        <span className={labelClass}>{label}</span>
      </Link>
    );
  };

  return (
    <aside
      className={`flex h-full flex-col justify-between overflow-y-auto border-r border-white/10 bg-deep-terrain py-6 ${
        rail ? "w-[72px] px-2 xl:w-60 xl:px-4" : "w-72 px-4"
      }`}
    >
      <div>
        <div className={`mb-8 ${rail ? "px-1 xl:px-3" : "px-3"}`}>
          <div className={`relative w-full ${rail ? "h-10 xl:h-24" : "h-24"}`}>
            <Image
              src="/images/areta-logo-mark-cropped.png"
              alt="Areta"
              fill
              sizes="240px"
              className="object-contain"
              priority
            />
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map(renderLink)}
        </nav>
      </div>

      <div>
        <div className="mb-4 flex flex-col gap-1 border-t border-white/10 pt-4">{FOOTER_ITEMS.map(renderLink)}</div>
        <p className={`mb-4 px-2 text-[11px] leading-relaxed text-mist ${labelClass}`}>
          Explore. Climb. Protect. Belong.
        </p>
        {/* Full-bleed ridge strip at the bottom, only where there's room
            for it: the full sidebar and the phone drawer, not the rail. */}
        <div className={`relative -mb-6 h-[13vh] overflow-hidden ${rail ? "-mx-2 hidden xl:-mx-4 xl:block" : "-mx-4"}`}>
          <Image src="/images/ridge-shadow.png" alt="" fill className="object-cover" sizes="288px" />
          <div className="absolute inset-0 bg-gradient-to-t from-deep-terrain/40 to-transparent" />
        </div>
      </div>
    </aside>
  );
}