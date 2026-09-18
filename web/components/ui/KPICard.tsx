import { Sparkline } from "@/components/ui/Sparkline";

type KPICardProps = {
  label: string;
  value: string;
  deltaLabel: string;
  trend: "up" | "down";
  icon?: React.ReactNode;
  /** Trailing 12 full calendar months, oldest first — see
   * lib/queries/kpiTrends.ts. Optional so KPICard still works for any
   * future card that doesn't have a trend series behind it. */
  sparkline?: number[];
};

export function KPICard({ label, value, deltaLabel, trend, icon, sparkline }: KPICardProps) {
  const deltaColor = trend === "up" ? "text-success" : "text-error";
  // Matches the success/error Tailwind tokens' actual hex values — SVG
  // stroke can't consume a Tailwind class directly, so this is kept in
  // sync with tailwind.config's success/error entries by hand.
  const sparkColor = trend === "up" ? "#2E7D32" : "#D32F2F";

  return (
    <div className="flex-1 rounded-xl bg-charcoal/40 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-mist">
          {icon}
          {label}
        </div>
        {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} color={sparkColor} />}
      </div>
      <div className="text-2xl font-medium text-cloud">{value}</div>
      <div className={`mt-1 text-xs ${deltaColor}`}>{deltaLabel} vs LY</div>
    </div>
  );
}