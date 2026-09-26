import type { Icon } from "@tabler/icons-react";
import { IconTile } from "@/components/ui/IconTile";

export type KpiTileProps = {
  label: string;
  value: string;
  icon: Icon;
  /** e.g. "+2.4%" or "+0.3pp". null when there's no comparison. */
  delta: string | null;
  /** Which way is good: for most KPIs up is good; for costs it isn't. */
  deltaGood?: boolean | null;
  comparison?: string;
};

export function KpiTile({ label, value, icon, delta, deltaGood, comparison = "vs LY" }: KpiTileProps) {
  const tone = deltaGood === null || deltaGood === undefined ? "text-mist" : deltaGood ? "text-success" : "text-error";
  const arrow = deltaGood === null || deltaGood === undefined ? "" : delta?.startsWith("-") ? "▼ " : "▲ ";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-deep-terrain p-3 md:p-4">
      <IconTile icon={icon} size={40} />
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-[0.15em] text-mist">{label}</p>
        <p className="truncate text-xl font-medium text-cloud md:text-2xl">{value}</p>
        <p className={`truncate text-xs ${tone}`}>
          {delta ? `${arrow}${delta} ${comparison}` : "No comparison"}
        </p>
      </div>
    </div>
  );
}

/** Five tiles: a swipeable strip on phones, then three and five across.
 * Snap scrolling keeps a tile from stopping half in view. */
export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-5 [&>*]:w-[78%] [&>*]:flex-shrink-0 [&>*]:snap-start md:[&>*]:w-auto">
      {children}
    </div>
  );
}

export function KpiStripSkeleton() {
  return (
    <KpiStrip>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[76px] animate-pulse rounded-xl border border-white/10 bg-deep-terrain md:h-[84px]" />
      ))}
    </KpiStrip>
  );
}