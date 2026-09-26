"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * The frame every page sits in, at three sizes:
 *  - phones (<768px): a sticky top bar, the menu slides out from the left,
 *    and the page scrolls normally.
 *  - tablets (768-1279px): the sidebar is a 72px icon rail, the page
 *    scrolls inside the main area.
 *  - desktop (1280px+): the full sidebar, and on tall enough screens each
 *    page fits the viewport exactly (the "fit" breakpoint).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer when the route changes, and stop the page behind it
  // scrolling while it's open.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-abyss md:flex md:h-screen md:overflow-hidden">
      <div className="hidden flex-shrink-0 md:block">
        <Sidebar />
      </div>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-deep-terrain/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="relative h-8 w-24">
          <Image src="/images/areta-logo-mark-cropped.png" alt="Areta" fill sizes="96px" className="object-contain object-left" />
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-cloud hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <IconMenu2 size={22} />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-abyss/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex">
            <Sidebar variant="drawer" onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="m-3 h-fit rounded-lg bg-deep-terrain p-2 text-cloud"
              aria-label="Close menu"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 md:overflow-y-auto md:p-6 fit:overflow-hidden">{children}</main>
    </div>
  );
}