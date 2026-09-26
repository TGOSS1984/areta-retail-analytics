import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Grid placement, e.g. "md:col-span-2 xl:col-span-7". */
  className?: string;
  /** Body height below the "fit" breakpoint, where the page scrolls and
   * every card needs a height of its own. On fit screens the card fills
   * its grid row instead. */
  mobileHeight?: string;
  children: ReactNode;
};

/** The card every page chart sits in: same border, radius and header as
 * the Overview charts, so the pages read as one product. */
export function ChartCard({ title, subtitle, action, className = "", mobileHeight = "h-[300px]", children }: ChartCardProps) {
  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col rounded-xl border border-white/10 bg-deep-terrain p-4 md:p-5 ${className}`}
    >
      <header className="mb-3 flex flex-shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-cloud">{title}</h2>
          <div className="mt-1.5 h-px w-6 bg-summit-gold" />
          {subtitle && <p className="mt-2 text-xs text-mist">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className={`relative min-h-0 ${mobileHeight} fit:h-auto fit:flex-1`}>{children}</div>
    </section>
  );
}