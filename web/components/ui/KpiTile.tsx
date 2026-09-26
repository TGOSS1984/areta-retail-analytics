import type { Icon } from "@tabler/icons-react";

export type KpiTileProps = {
  label: string;
  value: string;
  icon: Icon;
  /** e.g. "+2.4%" or "+0.3pp". null when there's no comparison. */
  delta: string | null;
  /** Which way is good. null shows the change in neutral grey, for
   * measures where up isn't simply better (online share, say). */
  deltaGood?: boolean | null;
  comparison?: string;
};

/** A page KPI, drawn the same way as the Overview hero's KPI cards: a
 * frosted panel over the banner image, gold icon and label, the value,
 * then the change. They sit inside PageHeader, over the image, so every
 * page opens like the Overview does. */
export function KpiTile({ label, value, icon: TileIcon, delta, deltaGood, comparison = "vs LY" }: KpiTileProps) {
  const neutral = deltaGood === null || deltaGood === undefined;
  const tone = neutral ? "text-mist" : deltaGood ? "text-success" : "text-error";
  return (
    <div className="min-w-0 rounded-xl bg-charcoal/40 p-3 backdrop-blur-sm md:p-4">
      <div className="mb-2 flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-wide text-summit-gold md:text-xs">
        <TileIcon size={16} className="flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-xl font-medium text-cloud md:text-2xl">{value}</div>
      <div className={`mt-1 truncate text-xs ${tone}`}>{delta ? `${delta} ${comparison}` : "No earlier year"}</div>
    </div>
  );
}

/** Five KPIs in the same grid as the Overview's six: two across on
 * phones, three on tablets, one row on desktop. */
export function KpiStrip({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</div>;
}

export function KpiStripSkeleton() {
  return (
    <KpiStrip>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[92px] animate-pulse rounded-xl bg-charcoal/30" />
      ))}
    </KpiStrip>
  );
}