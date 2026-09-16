type KPICardProps = {
  label: string;
  value: string;
  deltaLabel: string;
  trend: "up" | "down";
  icon?: React.ReactNode;
};

export function KPICard({ label, value, deltaLabel, trend, icon }: KPICardProps) {
  const deltaColor = trend === "up" ? "text-success" : "text-error";

  return (
    <div className="flex-1 rounded-xl bg-charcoal/40 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-mist">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-medium text-cloud">{value}</div>
      <div className={`mt-1 text-xs ${deltaColor}`}>{deltaLabel} vs LY</div>
    </div>
  );
}