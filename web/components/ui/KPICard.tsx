import { Sparkline } from "@/components/ui/Sparkline";

type KPICardProps = {
  label: string;
  value: string;
  /** null when there's no earlier year to compare with. */
  deltaLabel: string | null;
  trend: "up" | "down";
  icon?: React.ReactNode;
  /** Trailing 12 full calendar months, oldest first (lib/queries/kpiTrends.ts). */
  sparkline?: number[];
};

export function KPICard({ label, value, deltaLabel, trend, icon, sparkline }: KPICardProps) {
  const deltaColor = deltaLabel === null ? "text-mist" : trend === "up" ? "text-success" : "text-error";
  // SVG stroke can't take a Tailwind class, so these match the
  // success/error tokens in tailwind.config by hand.
  const sparkColor = trend === "up" ? "#2E7D32" : "#D32F2F";

  return (
    <div className="min-w-0 rounded-xl bg-charcoal/40 p-3 backdrop-blur-sm md:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-wide text-summit-gold md:text-xs">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        {sparkline && sparkline.length > 1 && (
          <span className="hidden sm:block">
            <Sparkline data={sparkline} color={sparkColor} />
          </span>
        )}
      </div>
      <div className="truncate text-xl font-medium text-cloud md:text-2xl">{value}</div>
      <div className={`mt-1 truncate text-xs ${deltaColor}`}>
        {deltaLabel === null ? "No earlier year" : `${deltaLabel} vs LY`}
      </div>
    </div>
  );
}