import Image from "next/image";
import { IconCoin, IconShoppingCart, IconPercentage, IconBuildingStore, IconTag } from "@tabler/icons-react";
import { KPICard } from "@/components/ui/KPICard";

// Real figures, computed from the actual warehouse data (business-year
// periods 1-7 of BY2026 vs the same periods of BY2025 — like-for-like,
// not partial-year vs full-year, which gave a misleading -48% on the
// first pass before the comparison was fixed). Still not LIVE — this
// updates when someone reruns the query, not on page load, since the
// DuckDB-wasm wiring isn't built yet. Swapping in live numbers later is
// a data-source change, not a layout change.
//
// Online/Store split from the original mockup isn't here — there's no
// online channel in the data model (deliberately parked, not an
// oversight). Retail vs Concession are the two channels that actually
// exist.
const KPIS = [
  { label: "Total sales", value: "£14.48M", deltaLabel: "-6.4%", trend: "down" as const, icon: <IconCoin size={14} /> },
  { label: "Total units", value: "413.3K", deltaLabel: "-5.4%", trend: "down" as const, icon: <IconShoppingCart size={14} /> },
  { label: "Gross margin", value: "69.8%", deltaLabel: "-0.1pp", trend: "down" as const, icon: <IconPercentage size={14} /> },
  { label: "Retail sales", value: "£12.40M", deltaLabel: "-6.5%", trend: "down" as const, icon: <IconBuildingStore size={14} /> },
  { label: "Concession sales", value: "£2.08M", deltaLabel: "-5.6%", trend: "down" as const, icon: <IconTag size={14} /> },
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
            <span className="rounded-full border border-white/20 px-3 py-1.5">Periods 1-7, BY2026</span>
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