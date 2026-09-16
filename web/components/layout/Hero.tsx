import Image from "next/image";
import { IconCoin, IconShoppingCart, IconPercentage, IconDeviceDesktop, IconBuildingStore } from "@tabler/icons-react";
import { KPICard } from "@/components/ui/KPICard";

// Placeholder figures until the DuckDB-wasm data wiring lands — shaped
// like the real KPI set (see docs/dax-measures.md), not invented from
// scratch, so swapping in live numbers later is a data change, not a
// layout change.
const KPIS = [
  { label: "Total sales", value: "£24.92M", deltaLabel: "+15.9%", trend: "up" as const, icon: <IconCoin size={14} /> },
  { label: "Total units", value: "382.4K", deltaLabel: "+12.4%", trend: "up" as const, icon: <IconShoppingCart size={14} /> },
  { label: "Gross margin", value: "54.8%", deltaLabel: "+2.6pp", trend: "up" as const, icon: <IconPercentage size={14} /> },
  { label: "Online sales", value: "£6.21M", deltaLabel: "+28.7%", trend: "up" as const, icon: <IconDeviceDesktop size={14} /> },
  { label: "Store sales", value: "£18.71M", deltaLabel: "+12.1%", trend: "up" as const, icon: <IconBuildingStore size={14} /> },
];

export function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <Image
        src="/images/hero-image-dark.webp"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-deep-terrain via-deep-terrain/70 to-deep-terrain/20" />

      <div className="relative flex flex-col justify-between p-8" style={{ minHeight: 280 }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-summit-gold">
              Data drives higher ground
            </p>
            <h1 className="mt-2 max-w-md text-2xl font-medium leading-snug text-cloud">
              Insights for a stronger tomorrow
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-cloud">
            <span className="rounded-full border border-white/20 px-3 py-1.5">Last 12 months</span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">All markets</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {KPIS.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>
    </div>
  );
}